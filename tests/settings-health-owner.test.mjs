import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const scripts = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts');
const health = require(path.join(scripts, 'folderviewplus.settings-health.js'));
const utils = require(path.join(scripts, 'folderviewplus.utils.js'));

test('health owner resolves global policy and folder overrides with documented provenance', () => {
    const api = health.createApi({ utils, getPrefsByType: () => ({ health: { profile: 'lenient',
        warnStoppedPercent: 70, criticalStoppedPercent: 80, updatesMode: 'ignore', allStoppedMode: 'warn' } }) });
    const policy = api.resolveFolderHealthPolicy({ settings: { health_profile: 'strict',
        health_warn_stopped_percent: 95, health_critical_stopped_percent: 50,
        health_updates_mode: 'maintenance', health_all_stopped_mode: 'critical' } });
    assert.deepEqual(policy, { profile: 'strict', warnThreshold: 95, warnSource: 'folder-warn',
        criticalThreshold: 100, criticalSource: 'auto-adjust', updatesMode: 'maintenance',
        updatesModeSource: 'folder-updates', allStoppedMode: 'critical', allStoppedModeSource: 'folder-all-stopped' });
    assert.equal(api.normalizeHealthPrefs('vm', { health: { vmResourceWarnVcpus: 512, vmResourceCriticalVcpus: 512 } }).vmResourceWarnVcpus, 511);
});

test('health owner computes complete scoring, reasons and alert policy without callback injection', () => {
    const api = health.createApi({ utils, getPrefsByType: () => ({}) });
    const folder = { settings: {} };
    const empty = api.evaluateDockerFolderHealth(folder, 0, {}, 0);
    assert.equal(empty.severity, 'empty'); assert.equal(empty.score, 100);
    assert.equal(empty.reasons[0].code, 'EMPTY_FOLDER');
    const healthy = api.evaluateDockerFolderHealth(folder, 10, { started: 10, paused: 0, stopped: 0 }, 0);
    assert.equal(healthy.severity, 'good'); assert.equal(healthy.score, 100);
    assert.equal(healthy.reasons[0].code, 'HEALTHY');
    const maintenance = api.evaluateDockerFolderHealth(folder, 10, { started: 10, paused: 0, stopped: 0 }, 3);
    assert.equal(maintenance.filterSeverity, 'maintenance'); assert.equal(maintenance.score, 94);
    assert.equal(maintenance.isAlert, false); assert.equal(maintenance.reasons[0].code, 'UPDATES_PENDING');
    const backlog = api.evaluateDockerFolderHealth({ settings: { health_updates_mode: 'warn' } }, 10, { started: 10, paused: 0, stopped: 0 }, 12);
    assert.equal(backlog.severity, 'critical'); assert.equal(backlog.score, 50);
    assert.equal(backlog.isAlert, true); assert.equal(backlog.reasons[0].code, 'UPDATE_SURGE');
    const stopped = api.evaluateDockerFolderHealth(folder, 4, { started: 0, paused: 0, stopped: 4 }, 0);
    assert.equal(stopped.severity, 'critical'); assert.equal(stopped.score, 0);
    assert.equal(stopped.reasons[0].code, 'ALL_STOPPED');
});

test('health metrics and direct folder scoring use the same live policy owner', () => {
    let prefs = { health: { allStoppedMode: 'critical' } };
    const api = health.createApi({ utils, getPrefsByType: () => prefs, getInfoByType: () => ({ stopped: {} }),
        getItemRuntimeStateKind: () => 'stopped', deriveFolderStatusKey: () => 'stopped' });
    const folders = { fixture: { name: 'Fixture', containers: ['stopped'], settings: {} } };
    const members = { fixture: { members: ['stopped'] } };
    assert.equal(api.buildTypeHealthMetrics('docker', folders, members).healthSeverityTotals.critical, 1);
    assert.equal(api.evaluateDockerFolderHealth(folders.fixture, 1, { stopped: 1 }, 0).severity, 'critical');
    prefs = { health: { allStoppedMode: 'warn' } };
    assert.equal(api.buildTypeHealthMetrics('docker', folders, members).healthSeverityTotals.warn, 1);
    assert.equal(api.evaluateDockerFolderHealth(folders.fixture, 1, { stopped: 1 }, 0).severity, 'warn');
});

test('Settings health facades delegate to one policy owner and preserve injected factory callbacks', () => {
    const main = fs.readFileSync(path.join(scripts, 'folderviewplus.js'), 'utf8');
    const calls = [];
    const owner = Object.fromEntries(['normalizeHealthPrefs', 'resolveFolderHealthPolicy', 'evaluateDockerFolderHealth']
        .map(name => [name, (...args) => { calls.push([name, args]); return name; }]));
    for (const [name, next] of [['normalizeHealthPrefs', 'normalizeStatusMode'], ['resolveFolderHealthPolicy', 'evaluateDockerFolderHealth'],
        ['evaluateDockerFolderHealth', 'toggleDockerUpdatesFilter']]) {
        const start = main.indexOf('const ' + name + ' ='), end = main.indexOf('const ' + next + ' =', start);
        const facade = vm.runInNewContext(main.slice(start, end) + '\n' + name, { getSettingsHealthApi: () => owner });
        assert.equal(facade('fixture'), name);
    }
    assert.deepEqual(calls.map(([name]) => name), ['normalizeHealthPrefs', 'resolveFolderHealthPolicy', 'evaluateDockerFolderHealth']);
    const overridden = health.createApi({ normalizeHealthPrefs: () => ({ cardsEnabled: false }),
        evaluateDockerFolderHealth: () => ({ severity: 'warn', filterSeverity: 'warn' }) });
    assert.equal(overridden.normalizeHealthPrefs('docker').cardsEnabled, false);
    assert.equal(overridden.evaluateDockerFolderHealth().severity, 'warn');
});

test('Settings table bootstrap refuses incomplete helpers and the page width adapter uses shipped metadata', () => {
    const main = fs.readFileSync(path.join(scripts, 'folderviewplus.js'), 'utf8');
    const start = main.indexOf('if (!settingsTableModule || ![');
    const end = main.indexOf('if (window.FolderViewPlusSetupAssistantSupportModuleLoaded', start);
    assert.ok(start >= 0 && end > start);
    const tableContext = vm.createContext({ FolderViewPlusSettingsMetadata: require(path.join(scripts, 'folderviewplus.settings-metadata.js')) });
    vm.runInContext(fs.readFileSync(path.join(scripts, 'folderviewplus.settings-table.js'), 'utf8'), tableContext);
    const table = tableContext.FolderViewPlusSettingsTable;
    for (const [module, missing] of [[table, false], [{ normalizeSettingsTablePreset: value => value }, true]]) {
        const unavailable = [];
        vm.runInNewContext(main.slice(start, end), { settingsTableModule: module, bootstrapMissingModules: unavailable,
            setFatalBannerModuleStatus() {} });
        assert.equal(unavailable.includes('folderviewplus.settings-table.js'), missing);
    }
    const adapterStart = main.indexOf('const buildEffectiveSettingsTableWidths =');
    const adapterEnd = main.indexOf('const applyColumnWidths =', adapterStart);
    const widths = vm.runInNewContext(main.slice(adapterStart, adapterEnd) + '\nbuildEffectiveSettingsTableWidths', {
        settingsTableModule: table, settingsTableWidthPresetByType: { docker: { name: 'wide', actions: 'compact' }, vm: { name: 'compact', actions: 'wide' } } });
    assert.equal(widths('docker').name, 420); assert.equal(widths('docker').actions, 160);
    assert.equal(widths('vm').name, 260); assert.equal(widths('vm').actions, 240);
});

test('the moved health evaluation retains its existing translation keys and interpolation', () => {
    const seen = [];
    const api = health.createApi({ utils, getPrefsByType: () => ({}), surfaceT: (key, _fallback, count) => {
        seen.push([key, count]); return 'translated ' + count;
    } });
    const model = api.evaluateDockerFolderHealth({ settings: {} }, 10, { started: 9, paused: 1, stopped: 0 }, 2);
    assert.equal(model.reasons.find(reason => reason.code === 'PAUSED_MEMBERS').message, 'translated 1');
    assert.equal(model.reasons.find(reason => reason.code === 'UPDATES_PENDING').message, 'translated 2');
    assert.deepEqual(seen, [['common.repair.paused-members-1-9c89f8', 1],
        ['common.repair.available-updates-1-1251a9', 2], ['common.repair.available-updates-1-1251a9', 2]]);
});
