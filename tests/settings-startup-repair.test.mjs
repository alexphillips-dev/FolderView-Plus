import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/';
const read = file => fs.readFileSync(root + file, 'utf8');
const settings = read('scripts/folderviewplus.js');
const refreshSource = settings.slice(settings.indexOf('const refreshType = async'), settings.indexOf('const getAdvancedModuleLoadEntry'));
const diagnostics = read('scripts/folderviewplus.activity-diagnostics.js');
const watchdog = read('scripts/folderviewplus.settings-watchdog.js');

test('server-rendered loading text and early timeout messages are localized before JavaScript catalogs arrive', () => {
    const review = JSON.parse(fs.readFileSync('scripts/lib/i18n_reviewed_startup.json', 'utf8'));
    const bootstrap = read('langs/script.php');
    const earlyCommon = bootstrap.slice(bootstrap.indexOf('    $earlyCommonCatalog ='), bootstrap.indexOf('    foreach ($earlyMessageKeys'));
    const span = read('FolderViewPlus.page').match(/<span data-i18n="common.startup.preparing">([\s\S]*?)<\/span>/)[1];
    const quote = value => JSON.stringify(path.resolve(value).replaceAll('\\', '/'));
    const php = `require ${quote(root + 'langs/registry.php')}; $results=[];
        foreach (json_decode(base64_decode('${Buffer.from(JSON.stringify(['en', ...Object.keys(review.locales)])).toString('base64')}'),true) as $resolvedLocale) {
            $earlyMessages=[];
            ${earlyCommon.replaceAll('__DIR__', quote(root + 'langs'))}
            ob_start(); ?>${span}<?php $results[$resolvedLocale]=[ob_get_clean(),$earlyMessages];
        } echo json_encode($results);`;
    const results = JSON.parse(execFileSync('php', ['-r', php], { encoding: 'utf8' }));
    for (const [locale, messages] of Object.entries({ en: review.en, ...review.locales })) {
        const escaped = messages[1].replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll("'", '&#039;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
        assert.equal(results[locale][0], escaped, locale);
        assert.equal(results[locale][1]['common.startup.timeout'], messages[2], locale);
        assert.equal(results[locale][1]['common.startup.timeout-detail'], messages[3], locale);
    }
});

test('Docker and VM hydration classify cold loads at request start, including compatibility fallback', async () => {
    for (const type of ['docker', 'vm']) for (const cold of [true, false]) for (const fallback of [true, false]) {
        let resolve, reject;
        const pending = new Promise((yes, no) => { resolve = yes; reject = no; });
        const samples = [];
        const context = vm.createContext({
            settingsUiState: { initialized: !cold }, perfNowMs: () => 100,
            fetchSettingsCoreSnapshot: () => pending,
            fetchFolders: async () => ({}), fetchPrefs: async () => ({}), fetchTypeInfo: async () => ({}),
            utils: { normalizePrefs: value => value, normalizeFolderMap: value => value },
            prefsByType: {}, infoByType: {}, runtimeHydrationStateByType: {},
            recordPerformanceDiagnosticsSample: (...args) => samples.push(args),
            ...Object.fromEntries(['recordFatalBannerAction', 'setFatalBannerPhase', 'markFatalBannerStep',
                'recordSettingsDashboardLayoutHydration', 'setFatalBannerPrefsStatus', 'setTypeFolders'].map(name => [name, () => {}]))
        });
        vm.runInContext(refreshSource + '\nglobalThis.refresh = refreshType;', context);
        const result = context.refresh(type, { render: false });
        context.settingsUiState.initialized = true;
        if (fallback) reject(new Error('Synthetic snapshot failure'));
        else resolve({ folders: {}, prefs: {}, info: {}, runtimeIncluded: true });
        assert.equal((await result).hasErrors, false);
        assert.equal(samples.length, 1);
        assert.equal(samples[0][1], type);
        assert.equal(samples[0][3].coldLoad, cold);
        assert.equal(samples[0][3].classificationVersion, 2);
        assert.equal(samples[0][3].dataSource, fallback ? 'runtime-legacy-fallback' : 'runtime-snapshot');
    }
});

const loadDiagnostics = stored => {
    const events = {};
    const writes = {};
    const window = { addEventListener: (name, handler) => { events[name] = handler; } };
    const context = vm.createContext({
        window, document: { readyState: 'loading', addEventListener() {} }, console,
        location: { href: 'http://localhost/Settings/FolderViewPlus' }, navigator: {},
        localStorage: { getItem: key => key === 'fv.performance.diagnostics.history.v1' ? JSON.stringify(stored) : null,
            setItem: (key, value) => { writes[key] = value; } },
        $: () => ({ length: 0 }), setTimeout: () => 1, clearTimeout() {}
    });
    vm.runInContext(diagnostics.replace('window.FolderViewPlusDiagnosticsModuleLoaded = true;',
        'window.testSummaryCard = buildPerformanceBudgetDiagnosticsSummaryCard; window.FolderViewPlusDiagnosticsModuleLoaded = true;'), context);
    return { api: window.FolderViewPlusDiagnostics, events, writes, context, card: window.testSummaryCard };
};

test('history migration drops ambiguous hydration samples but retains reliable timings and persists the repaired history', () => {
    const sample = details => ({ at: Date.now(), durationMs: 3500, details });
    const legacy = sample({ coldLoad: false });
    const cold = sample({ coldLoad: true, classificationVersion: 2 });
    const warm = sample({ coldLoad: false, classificationVersion: 2 });
    const { api, events, writes } = loadDiagnostics({ schemaVersion: 1, state: {
        runtimeHydration: { docker: [legacy, legacy, cold], vm: [legacy, warm, warm] },
        settings: { configbootstrap: [legacy], diagnostics: [legacy] }
    } });
    const telemetry = api.collectClientPerformanceTelemetry();
    assert.equal(telemetry.settings.runtimeHydration.docker.count, 1);
    assert.equal(telemetry.settings.runtimeHydration.docker.coldLoadCount, 1);
    assert.equal(telemetry.settings.runtimeHydration.docker.overBudget, false);
    assert.equal(telemetry.settings.runtimeHydration.vm.warmSampleCount, 2);
    assert.equal(telemetry.settings.runtimeHydration.vm.overBudget, true);
    assert.equal(telemetry.settings.configBootstrap.count, 1);
    assert.equal(telemetry.settings.diagnosticsRefresh.count, 1);
    events.pagehide();
    const persisted = JSON.parse(writes['fv.performance.diagnostics.history.v1']);
    assert.equal(persisted.state.runtimeHydration.vm.length, 2);
    assert.equal(persisted.state.runtimeHydration.docker[0].details.classificationVersion, 2);
    assert.equal(loadDiagnostics(persisted).api.collectClientPerformanceTelemetry().history.storedSampleCount, 5);
});

test('performance warning renders a complete translated message rather than English grammar fragments', () => {
    const review = JSON.parse(fs.readFileSync('scripts/lib/i18n_reviewed_startup.json', 'utf8'));
    for (const [locale, values] of Object.entries(review.locales)) {
        const { api, context, card } = loadDiagnostics(null);
        const catalog = JSON.parse(read(`langs/namespaces/${locale}/common.json`));
        const calls = [];
        context.FolderViewPlusI18n = { t: (key, fallback, count) => {
            calls.push([key, count]);
            return (catalog[key] ?? fallback).replace('$1', String(count));
        } };
        api.recordPerformanceDiagnosticsSample('runtimeHydration', 'vm', 3500, { coldLoad: false, classificationVersion: 2 });
        api.recordPerformanceDiagnosticsSample('runtimeHydration', 'vm', 3600, { coldLoad: false, classificationVersion: 2 });
        assert.equal(card().headline, values[0].replace('$1', '1'), locale);
        assert.deepEqual(calls.at(-1), ['common.startup.performance-followup', 1]);
    }
});

const loadWatchdog = ({ loading = true, content = false, early = {} } = {}) => {
    const timers = [], reports = [];
    const node = { nodeType: 1, children: [], getBoundingClientRect: () => ({ width: 300, height: 100 }),
        querySelector: () => null, querySelectorAll: () => content ? [node] : [] };
    const window = { setTimeout: (handler, delay) => timers.push({ handler, delay }),
        getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1' }),
        FolderViewPlusEarlyI18n: { messages: early },
        FolderViewPlusFatalBanner: { reportFatalError: (error, options) => reports.push({ error, ...options }) } };
    const context = vm.createContext({ window, document: { getElementById: id =>
        id === 'fv-settings-root' || (id === 'fv-settings-bootstrap-shell' && loading) ? node : null } });
    vm.runInContext(watchdog, context);
    vm.runInContext(watchdog, context);
    return { window, reports, timers, fire: delay => timers.find(timer => timer.delay === delay).handler() };
};

test('visible loading is allowed beyond both blank checks and successful startup cancels the final check', () => {
    const fixture = loadWatchdog();
    assert.equal(fixture.timers.length, 3, 'repeated installation must not duplicate timers');
    fixture.fire(3500); fixture.fire(8500);
    assert.equal(fixture.reports.length, 0);
    fixture.window.FolderViewPlusMarkSettingsBootstrapState({ ready: true });
    fixture.fire(60000);
    assert.equal(fixture.reports.length, 0);
});

test('permanently loading Settings times out once with localized text and a distinct incident code', () => {
    const early = JSON.parse(read('langs/namespaces/de/common.json'));
    const fixture = loadWatchdog({ early });
    fixture.fire(3500); fixture.fire(8500); fixture.fire(60000); fixture.fire(60000);
    assert.equal(fixture.reports.length, 1);
    assert.equal(fixture.reports[0].code, 'FVPLUS-SET-LOAD-001');
    assert.equal(fixture.reports[0].category, 'timeout');
    assert.equal(fixture.reports[0].title, early['common.startup.timeout']);
    assert.equal(fixture.reports[0].message, early['common.startup.timeout-detail']);
    assert.doesNotMatch(fixture.reports[0].error.message, /blank|no visible/);
});

test('genuinely blank pages still fail early while existing failures and visible content do not duplicate errors', () => {
    const blank = loadWatchdog({ loading: false });
    blank.fire(3500); blank.fire(8500); blank.fire(60000);
    assert.equal(blank.reports.length, 1);
    assert.equal(blank.reports[0].code, 'FVPLUS-SET-BLANK-001');
    const failed = loadWatchdog();
    failed.window.FolderViewPlusMarkSettingsBootstrapState({ failed: true });
    failed.fire(3500); failed.fire(8500); failed.fire(60000);
    assert.equal(failed.reports.length, 0);
    const visible = loadWatchdog({ loading: false, content: true });
    visible.fire(3500); visible.fire(8500); visible.fire(60000);
    assert.equal(visible.reports.length, 0);
});
