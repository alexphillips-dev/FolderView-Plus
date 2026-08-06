import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const pluginRoot = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus');
const langsRoot = path.join(pluginRoot, 'langs');
const registryPath = path.join(langsRoot, 'registry.php');

const phpQuote = (value) => `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const runRegistryPhp = (expression) => JSON.parse(execFileSync('php', ['-r', `require ${phpQuote(registryPath)}; echo json_encode(${expression}, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);`], {
    cwd: repoRoot,
    encoding: 'utf8'
}));

test('regional locale resolution distinguishes Simplified and Traditional Chinese plus Portuguese variants', () => {
    const resolutions = runRegistryPhp(`[
        'zh' => fvplus_i18n_resolve_locale('zh'),
        'zhCN' => fvplus_i18n_resolve_locale('zh_CN'),
        'zhSG' => fvplus_i18n_resolve_locale('zh_SG'),
        'zhMY' => fvplus_i18n_resolve_locale('zh_MY'),
        'zhHans' => fvplus_i18n_resolve_locale('zh_Hans'),
        'zhTW' => fvplus_i18n_resolve_locale('zh_TW'),
        'zhHK' => fvplus_i18n_resolve_locale('zh_HK'),
        'zhMO' => fvplus_i18n_resolve_locale('zh_MO'),
        'zhHant' => fvplus_i18n_resolve_locale('zh_Hant'),
        'pt' => fvplus_i18n_resolve_locale('pt'),
        'ptBR' => fvplus_i18n_resolve_locale('pt_BR')
    ]`);

    assert.equal(resolutions.zh.resolved, 'zh-Hans');
    assert.equal(resolutions.zhCN.resolved, 'zh-Hans');
    assert.deepEqual(resolutions.zhCN.fallbackChain, ['zh-CN', 'zh-Hans', 'en']);
    assert.equal(resolutions.zhSG.resolved, 'zh-Hans');
    assert.equal(resolutions.zhMY.resolved, 'zh-Hans');
    assert.equal(resolutions.zhHans.resolved, 'zh-Hans');
    assert.equal(resolutions.zhTW.resolved, 'en', 'Traditional Chinese must not silently use Simplified Chinese');
    assert.deepEqual(resolutions.zhTW.fallbackChain, ['zh-TW', 'zh-Hant', 'en']);
    assert.equal(resolutions.zhHK.resolved, 'en', 'Hong Kong Chinese must wait for a reviewed Traditional catalog');
    assert.equal(resolutions.zhMO.resolved, 'en', 'Macau Chinese must wait for a reviewed Traditional catalog');
    assert.equal(resolutions.zhHant.resolved, 'en', 'explicit Traditional Chinese must not use Simplified Chinese');
    assert.equal(resolutions.pt.resolved, 'pt-PT', 'generic Portuguese should use the complete European Portuguese catalog');
    assert.ok(resolutions.pt.fallbackChain.includes('pt-PT'));
    assert.equal(resolutions.pt.requestedStatus, 'complete');
    assert.equal(resolutions.ptBR.requestedStatus, 'complete');
});

test('catalog report exposes honest legacy and namespace coverage for every registered locale', () => {
    const report = runRegistryPhp('fvplus_i18n_catalog_report()');
    assert.equal(report.catalogVersion, '2026.07.29.2');
    assert.ok(report.sourceMessageCount > 1900);
    assert.equal(report.namespaceCount, 10);
    assert.equal(report.extraction.candidateCount, 0);
    assert.equal(report.extraction.autoBoundMessageCount, 1583);
    assert.equal(report.extraction.catalogMessageCount, report.sourceMessageCount);
    assert.equal(Object.keys(report.locales).length, 18);
    assert.equal(report.locales.en.coveragePercent, 100);
    assert.equal(report.locales.en.reviewedAgainstCurrentSource, true);
    for (const row of Object.values(report.locales)) {
        assert.equal(row.coveragePercent, 100);
        assert.equal(row.missingMessages, 0);
        assert.equal(row.reviewedAgainstCurrentSource, true);
        assert.equal(row.potentiallyStaleMessages, 0);
    }
    assert.equal(report.locales.es.status, 'complete');
    assert.equal(report.locales.es.namespaces.settings.translated, report.locales.es.namespaces.settings.total);
    assert.equal(report.locales['pt-BR'].translatedMessages, report.sourceMessageCount);
    assert.equal(report.locales['zh-Hans'].status, 'complete');
});

test('Simplified Chinese includes native labels across every primary plugin surface', () => {
    const cases = {
        common: { 'common.close': '关闭' },
        dashboard: { 'dashboard.folder.toggle-members': '切换文件夹成员' },
        diagnostics: { 'diagnostics.title': '诊断' },
        docker: { 'docker.actions.add-folder': '添加文件夹' },
        editor: { 'editor.actions.add-custom': '添加自定义操作' },
        import: { 'import.mode.merge.title': '安全合并' },
        settings: { 'settings.search.placeholder': '搜索设置' },
        wizard: { 'wizard.title': '设置助手' }
    };
    for (const [namespace, expectedMessages] of Object.entries(cases)) {
        const catalog = JSON.parse(fs.readFileSync(
            path.join(langsRoot, 'namespaces', 'zh-Hans', `${namespace}.json`),
            'utf8'
        ));
        assert.equal(catalog['@metadata'].locale, 'zh-Hans');
        for (const [key, expected] of Object.entries(expectedMessages)) {
            assert.equal(catalog[key], expected, `${namespace}:${key}`);
        }
    }
});

test('runtime pages can request a compact catalog report without scanning every locale', () => {
    const report = runRegistryPhp("fvplus_i18n_catalog_report(['en', 'es'])");
    assert.deepEqual(Object.keys(report.locales), ['en', 'es']);
    assert.equal(report.locales.en.coveragePercent, 100);
    assert.equal(report.locales.es.status, 'complete');
    const loader = fs.readFileSync(path.join(langsRoot, 'script.php'), 'utf8');
    assert.match(loader, /fvplus_i18n_catalog_report\(\['en', \$requestedLocale, \$resolvedLocale\]\)/);
});

test('browser runtime activates the resolved catalog while preserving the requested document locale', () => {
    const runtime = fs.readFileSync(path.join(pluginRoot, 'scripts/folderviewplus.i18n.js'), 'utf8');
    assert.match(runtime, /state\.activeLocale = state\.resolvedLocale/);
    assert.match(runtime, /jQuery\.i18n\(\{ locale: state\.resolvedLocale, fallbackLocale: 'en' \}\)/);
    assert.match(runtime, /setDocumentLocale\(state\.requestedLocale, state\.direction\)/);
    assert.doesNotMatch(runtime, /jQuery\.i18n\(\{ locale: state\.requestedLocale/);
});

test('all registered locales have complete namespace catalogs', () => {
    const registry = runRegistryPhp('fvplus_i18n_registry()');
    const namespaceNames = fs.readdirSync(path.join(langsRoot, 'namespaces/en'))
        .filter((file) => file.endsWith('.json'))
        .sort();
    for (const [locale, entry] of Object.entries(registry)) {
        for (const namespaceName of namespaceNames) {
            assert.equal(fs.existsSync(path.join(langsRoot, 'namespaces', locale, namespaceName)), true, `${locale}/${namespaceName}`);
        }
        assert.ok(['source', 'complete'].includes(entry.status), `${locale} must be ready to ship`);
        assert.equal(entry.reviewed, true, `${locale} must be maintainer accepted`);
    }
});

test('browser smoke captures expanded and RTL pseudo-locale states', () => {
    const browserSmoke = fs.readFileSync(path.join(repoRoot, 'scripts/browser_smoke.mjs'), 'utf8');
    assert.match(browserSmoke, /usePseudoLocale\('en-XA'\)/);
    assert.match(browserSmoke, /usePseudoLocale\('ar-XB'\)/);
    assert.match(browserSmoke, /locale-en-xa\.png/);
    assert.match(browserSmoke, /locale-ar-xb\.png/);
    assert.match(browserSmoke, /rtlState\.dir !== 'rtl'/);
});

test('diagnostics and support bundles expose localization readiness', () => {
    const diagnosticsUi = fs.readFileSync(path.join(pluginRoot, 'scripts/folderviewplus.activity-diagnostics.js'), 'utf8');
    const diagnosticsServer = fs.readFileSync(path.join(pluginRoot, 'server/lib.diagnostics.php'), 'utf8');
    assert.match(diagnosticsUi, /buildLocalizationDiagnosticsSummaryCard/);
    assert.match(diagnosticsUi, /localeCoverage/);
    assert.match(diagnosticsUi, /potentiallyStaleMessages/);
    assert.match(diagnosticsServer, /activeLocaleCoverage/);
    assert.match(diagnosticsServer, /sourceMessageCount/);
});
