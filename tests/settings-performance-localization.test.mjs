import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/';
const source = fs.readFileSync(root + 'scripts/folderviewplus.js', 'utf8');
const render = source.slice(source.indexOf('const renderPerformancePolicySummary ='), source.indexOf('const renderDashboardControls ='));
const diagnostics = fs.readFileSync(root + 'scripts/folderviewplus.activity-diagnostics.js', 'utf8');

test('Settings performance summaries use loaded translations for every profile, type and locale', () => {
    const locales = fs.readdirSync(root + 'langs/namespaces');
    for (const locale of locales) {
        const catalog = Object.assign({}, ...['common', 'legacy-surface', 'settings', 'wizard', 'import', 'diagnostics']
            .map(namespace => JSON.parse(fs.readFileSync(`${root}langs/namespaces/${locale}/${namespace}.json`, 'utf8'))));
        const missing = new Set();
        const rendered = [];
        const context = vm.createContext({
            utils: { normalizePrefs: value => value, normalizePerformanceProfile: value => value },
            dockers: {}, vms: {}, infoByType: { docker: {}, vm: {} }, window: {},
            surfaceT: (key, fallback, ...args) => {
                if (!Object.hasOwn(catalog, key)) missing.add(key);
                return args.reduce((value, arg, index) => value.replaceAll('$' + (index + 1), String(arg)), catalog[key] || fallback);
            },
            $: () => ({ text: value => rendered.push(value) })
        });
        vm.runInContext(render + '; globalThis.renderSummary = renderPerformancePolicySummary;', context);
        for (const type of ['docker', 'vm']) for (const performanceProfile of ['standard', 'adaptive', 'maximum']) {
            context.renderSummary(type, { performanceProfile, liveRefreshEnabled: true, liveRefreshSeconds: 20, lazyPreviewThreshold: 8 });
        }
        assert.deepEqual([...missing], [], locale);
        assert.equal(rendered.length, 6);
        assert.ok(rendered[0].startsWith(catalog['legacy.surface.ef6691545d2c5523'] + ':'), locale);
    }
});

test('diagnostics still warns for real missing keys and reports healthy English after a clean session', () => {
    const context = vm.createContext({
        window: { FolderViewPlusI18n: { snapshot: () => ({ requestedLocale: 'en', resolvedLocale: 'en',
            activeLocaleReport: { coveragePercent: 100, translatedMessages: 1, totalSourceMessages: 1 },
            missingKeyCount: context.missingCount, recentMissingKeys: [], loadErrors: [], localeCoverage: {} }) } },
        document: { readyState: 'loading', addEventListener() {} }, console,
        location: { href: 'http://localhost/Settings/FolderViewPlus' }, navigator: {},
        localStorage: { getItem: () => null }, $: () => ({ length: 0 }), setTimeout: () => 1, clearTimeout() {},
        missingCount: 0
    });
    context.window.addEventListener = () => {};
    vm.runInContext(diagnostics.replace('window.FolderViewPlusDiagnosticsModuleLoaded = true;',
        'globalThis.localizationCard = buildLocalizationDiagnosticsSummaryCard; window.FolderViewPlusDiagnosticsModuleLoaded = true;'), context);
    assert.equal(context.localizationCard().status, 'healthy');
    context.missingCount = 1;
    assert.equal(context.localizationCard().status, 'warning');
    assert.deepEqual(JSON.parse(fs.readFileSync('scripts/production_perf_budgets.json')).knownMissingKeys, []);
});
