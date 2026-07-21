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

test('regional locale resolution distinguishes Simplified Chinese and Portuguese variants', () => {
    const resolutions = runRegistryPhp(`[
        'zhCN' => fvplus_i18n_resolve_locale('zh_CN'),
        'zhTW' => fvplus_i18n_resolve_locale('zh_TW'),
        'pt' => fvplus_i18n_resolve_locale('pt'),
        'ptBR' => fvplus_i18n_resolve_locale('pt_BR')
    ]`);

    assert.equal(resolutions.zhCN.resolved, 'zh-Hans');
    assert.deepEqual(resolutions.zhCN.fallbackChain, ['zh-CN', 'zh-Hans', 'en']);
    assert.equal(resolutions.zhTW.resolved, 'en', 'Traditional Chinese must not silently use Simplified Chinese');
    assert.deepEqual(resolutions.zhTW.fallbackChain, ['zh-TW', 'zh-Hant', 'en']);
    assert.equal(resolutions.pt.resolved, 'pt-PT', 'generic Portuguese should use the complete European Portuguese catalog');
    assert.ok(resolutions.pt.fallbackChain.includes('pt-PT'));
    assert.equal(resolutions.pt.requestedStatus, 'complete');
    assert.equal(resolutions.ptBR.requestedStatus, 'complete');
});

test('catalog report exposes honest legacy and namespace coverage for every registered locale', () => {
    const report = runRegistryPhp('fvplus_i18n_catalog_report()');
    assert.equal(report.catalogVersion, '2026.07.21.1');
    assert.ok(report.sourceMessageCount > 1900);
    assert.equal(report.namespaceCount, 10);
    assert.equal(report.extraction.candidateCount, 0);
    assert.equal(report.extraction.autoBoundMessageCount, 1563);
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

test('runtime pages can request a compact catalog report without scanning every locale', () => {
    const report = runRegistryPhp("fvplus_i18n_catalog_report(['en', 'es'])");
    assert.deepEqual(Object.keys(report.locales), ['en', 'es']);
    assert.equal(report.locales.en.coveragePercent, 100);
    assert.equal(report.locales.es.status, 'complete');
    const loader = fs.readFileSync(path.join(langsRoot, 'script.php'), 'utf8');
    assert.match(loader, /fvplus_i18n_catalog_report\(\['en', \$requestedLocale, \$resolvedLocale\]\)/);
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
