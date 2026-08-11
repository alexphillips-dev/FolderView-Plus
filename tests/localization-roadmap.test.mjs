import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import OpenCC from 'opencc-js';

const repoRoot = path.resolve(process.cwd());
const pluginRoot = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus');
const langsRoot = path.join(pluginRoot, 'langs');
const registryPath = path.join(langsRoot, 'registry.php');

const phpQuote = (value) => `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const runRegistryPhp = (expression) => JSON.parse(execFileSync('php', ['-r', `require ${phpQuote(registryPath)}; echo json_encode(${expression}, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);`], {
    cwd: repoRoot,
    encoding: 'utf8'
}));

test('regional locale resolution maps exact Unraid identifiers to canonical catalogs', () => {
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
        'ar' => fvplus_i18n_resolve_locale('ar_AR'),
        'bnUnraid' => fvplus_i18n_resolve_locale('bn_BN'),
        'bnStandard' => fvplus_i18n_resolve_locale('bn_BD'),
        'ca' => fvplus_i18n_resolve_locale('ca_CA'),
        'da' => fvplus_i18n_resolve_locale('da_DA'),
        'hr' => fvplus_i18n_resolve_locale('hr_HR'),
        'hu' => fvplus_i18n_resolve_locale('hu_HU'),
        'lv' => fvplus_i18n_resolve_locale('lv_LV'),
        'no' => fvplus_i18n_resolve_locale('no_NO'),
        'nb' => fvplus_i18n_resolve_locale('nb_NO'),
        'pt' => fvplus_i18n_resolve_locale('pt'),
        'ptBR' => fvplus_i18n_resolve_locale('pt_BR')
    ]`);

    assert.equal(resolutions.zh.resolved, 'zh-Hans');
    assert.equal(resolutions.zhCN.resolved, 'zh-Hans');
    assert.deepEqual(resolutions.zhCN.fallbackChain, ['zh-CN', 'zh-Hans', 'en']);
    assert.equal(resolutions.zhSG.resolved, 'zh-Hans');
    assert.equal(resolutions.zhMY.resolved, 'zh-Hans');
    assert.equal(resolutions.zhHans.resolved, 'zh-Hans');
    assert.equal(resolutions.zhTW.resolved, 'zh-Hant');
    assert.deepEqual(resolutions.zhTW.fallbackChain, ['zh-TW', 'zh-Hant', 'en']);
    assert.equal(resolutions.zhHK.resolved, 'zh-Hant');
    assert.equal(resolutions.zhMO.resolved, 'zh-Hant');
    assert.equal(resolutions.zhHant.resolved, 'zh-Hant');
    assert.equal(resolutions.ar.resolved, 'ar');
    assert.equal(resolutions.ar.direction, 'rtl');
    assert.equal(resolutions.bnUnraid.resolved, 'bn');
    assert.deepEqual(resolutions.bnUnraid.fallbackChain, ['bn-BN', 'bn', 'en']);
    assert.equal(resolutions.bnStandard.resolved, 'bn');
    for (const locale of ['ca', 'da', 'hr', 'hu', 'lv']) {
        assert.equal(resolutions[locale].resolved, locale);
    }
    assert.equal(resolutions.no.resolved, 'nb');
    assert.deepEqual(resolutions.no.fallbackChain, ['no-NO', 'nb', 'en']);
    assert.equal(resolutions.nb.resolved, 'nb');
    assert.equal(resolutions.pt.resolved, 'pt-PT', 'generic Portuguese should use the complete European Portuguese catalog');
    assert.ok(resolutions.pt.fallbackChain.includes('pt-PT'));
    assert.equal(resolutions.pt.requestedStatus, 'complete');
    assert.equal(resolutions.ptBR.requestedStatus, 'complete');
});

test('catalog report exposes honest legacy and namespace coverage for every registered locale', () => {
    const report = runRegistryPhp('fvplus_i18n_catalog_report()');
    assert.equal(report.catalogVersion, '2026.08.10.1');
    assert.ok(report.sourceMessageCount > 1900);
    assert.equal(report.namespaceCount, 10);
    assert.equal(report.extraction.candidateCount, 0);
    assert.equal(report.extraction.autoBoundMessageCount, 1581);
    assert.equal(report.extraction.catalogMessageCount, report.sourceMessageCount);
    assert.equal(Object.keys(report.locales).length, 27);
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
    assert.equal(report.locales['zh-Hant'].status, 'complete');
    assert.equal(report.locales.ar.direction, 'rtl');
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

test('new Unraid locales include native labels across every primary plugin surface', () => {
    const surfaces = [
        ['common', 'common.close'],
        ['dashboard', 'dashboard.folder.toggle-members'],
        ['diagnostics', 'diagnostics.title'],
        ['docker', 'docker.actions.add-folder'],
        ['editor', 'editor.actions.add-custom'],
        ['import', 'import.mode.merge.title'],
        ['settings', 'settings.search.placeholder'],
        ['wizard', 'wizard.title']
    ];
    const expected = {
        ar: ['إغلاق', 'تبديل أعضاء المجلد', 'التشخيص', 'إضافة مجلد', 'إضافة إجراء مخصص', 'دمج بأمان', 'إعدادات البحث', 'مساعد الإعداد'],
        bn: ['বন্ধ', 'ফোল্ডার সদস্যদের টগল করুন', 'ডায়াগনস্টিকস', 'ফোল্ডার যোগ করুন', 'একটি কাস্টম কর্ম যোগ করুন', 'নিরাপদে একত্রিত করুন', 'অনুসন্ধান সেটিংস', 'সহকারী সেটআপ করুন'],
        ca: ['Tancar', 'Commuta els membres de la carpeta', 'Diagnòstics', 'Afegeix una carpeta', 'Afegeix una acció personalitzada', 'Combina amb seguretat', 'Configuració de cerca', 'Assistent de configuració'],
        da: ['Luk', 'Skift mappemedlemmer', 'Diagnostik', 'Tilføj mappe', 'Tilføj en tilpasset handling', 'Flet sikkert sammen', 'Søgeindstillinger', 'Opsætningsassistent'],
        hr: ['Zatvori', 'Promjena članova mape', 'Dijagnostika', 'Dodaj mapu', 'Dodajte prilagođenu radnju', 'Spojite sigurno', 'Postavke pretraživanja', 'Pomoćnik za postavljanje'],
        hu: ['Bezárás', 'Mappatagok váltása', 'Diagnosztika', 'Mappa hozzáadása', 'Egyéni művelet hozzáadása', 'Egyesítse biztonságosan', 'Keresési beállítások', 'Beállítási asszisztens'],
        lv: ['Aizvērt', 'Pārslēgt mapes dalībniekus', 'Diagnostika', 'Pievienot mapi', 'Pievienojiet pielāgotu darbību', 'Droši sapludiniet', 'Meklēšanas iestatījumi', 'Iestatīšanas palīgs'],
        nb: ['Lukk', 'Veksle mappemedlemmer', 'Diagnostikk', 'Legg til mappe', 'Legg til en egendefinert handling', 'Slå sammen trygt', 'Søkeinnstillinger', 'Oppsettassistent'],
        'zh-Hant': ['關閉', '切換資料夾成員', '診斷', '新增資料夾', '新增自訂操作', '安全合併', '搜尋設定', '設定助手']
    };
    for (const [locale, translations] of Object.entries(expected)) {
        for (const [index, [namespace, key]] of surfaces.entries()) {
            const catalog = JSON.parse(fs.readFileSync(
                path.join(langsRoot, 'namespaces', locale, `${namespace}.json`),
                'utf8'
            ));
            assert.equal(catalog['@metadata'].locale, locale);
            assert.equal(catalog[key], translations[index], `${locale}:${namespace}:${key}`);
        }
    }
});

test('Traditional Chinese uses the pinned one-pass Taiwan normalization profile', () => {
    const rootCatalog = JSON.parse(fs.readFileSync(path.join(langsRoot, 'zh-Hant.json'), 'utf8'));
    assert.equal(rootCatalog['@metadata']['normalization-profile'], 'opencc-s2twp-1.4.1');
    assert.match(rootCatalog['border-color-tooltip'], /設定預覽邊框的顏色/);
    assert.doesNotMatch(rootCatalog['border-color-tooltip'], /设置|预览|按钮|文件夹/);
    const converter = OpenCC.Converter({ from: 'cn', to: 'twp' });
    assert.equal(converter('设置文件夹并导出软件'), '設定資料夾並匯出軟體');
    const builder = fs.readFileSync(path.join(repoRoot, 'scripts/build_i18n_surface_catalogs.mjs'), 'utf8');
    assert.match(builder, /opencc-s2twp-1\.4\.1/);
    assert.match(builder, /normalizeLocaleMessages/);
});

test('Arabic, Croatian, and Latvian import summaries include every CLDR plural form', () => {
    const expectedFormCounts = { ar: 6, hr: 3, lv: 3 };
    for (const [locale, minimum] of Object.entries(expectedFormCounts)) {
        const catalog = JSON.parse(fs.readFileSync(path.join(langsRoot, 'namespaces', locale, 'import.json'), 'utf8'));
        for (const key of [
            'import.review.count',
            'import.summary.folder-change',
            'import.summary.planned-change',
            'import.summary.update',
            'import.summary.delete'
        ]) {
            const expression = catalog[key].match(/\{\{PLURAL:[^}]+\}\}/u)?.[0];
            assert.ok(expression, `${locale}:${key} needs plural syntax`);
            assert.ok(expression.split('|').length - 1 >= minimum, `${locale}:${key} needs ${minimum} forms`);
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
