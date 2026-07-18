import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const repoRoot = path.resolve(process.cwd());
const pluginRoot = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus'
);
const langsRoot = path.join(pluginRoot, 'langs');
const runtimeSource = fs.readFileSync(path.join(pluginRoot, 'scripts/folderviewplus.i18n.js'), 'utf8');

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

const createRuntime = (catalogs) => {
    const messageStore = {
        messages: {},
        set(locale, messages) {
            this.messages[locale] = { ...(this.messages[locale] || {}), ...messages };
        }
    };
    let locale = 'en';
    let fallbackLocale = 'en';
    let translatedDomCount = 0;
    const instance = {
        async load(messages, catalogLocale) {
            messageStore.set(catalogLocale, messages);
        }
    };
    const i18n = (...args) => {
        if (args.length === 0) {
            return instance;
        }
        if (args[0] && typeof args[0] === 'object') {
            locale = args[0].locale || locale;
            fallbackLocale = args[0].fallbackLocale || fallbackLocale;
            return instance;
        }
        const key = String(args[0] || '');
        const params = args.slice(1);
        const baseLocale = String(locale).split('-')[0];
        const value = messageStore.messages[locale]?.[key]
            ?? messageStore.messages[baseLocale]?.[key]
            ?? messageStore.messages[fallbackLocale]?.[key]
            ?? key;
        return String(value).replace(/\$(\d+)/g, (match, index) => {
            const position = Number(index) - 1;
            return position < params.length ? String(params[position]) : match;
        });
    };
    i18n.messageStore = messageStore;

    const jquery = () => ({
        i18n() {
            translatedDomCount += 1;
        }
    });
    jquery.i18n = i18n;

    const documentElement = {};
    const dispatchedEvents = [];
    class CustomEvent {
        constructor(type, options = {}) {
            this.type = type;
            this.detail = options.detail;
        }
    }
    const window = {
        jQuery: jquery,
        document: {
            documentElement,
            body: {},
            dispatchEvent(event) {
                dispatchedEvents.push(event);
            }
        },
        CustomEvent,
        async fetch(url) {
            if (!Object.hasOwn(catalogs, url)) {
                return { ok: false, status: 404, async json() { return {}; } };
            }
            return { ok: true, status: 200, async json() { return catalogs[url]; } };
        }
    };
    vm.runInNewContext(runtimeSource, { window, console, Intl, Date, Promise, Set, Map }, {
        filename: 'folderviewplus.i18n.js'
    });
    return {
        api: window.FolderViewPlusI18n,
        documentElement,
        dispatchedEvents,
        getTranslatedDomCount: () => translatedDomCount
    };
};

test('locale catalogs expose consistent versioned metadata and unique English keys', () => {
    const englishCatalogFiles = [
        path.join(langsRoot, 'en.json'),
        ...fs.readdirSync(path.join(langsRoot, 'namespaces/en'))
            .filter((file) => file.endsWith('.json'))
            .map((file) => path.join(langsRoot, 'namespaces/en', file))
    ];
    const englishKeys = new Set();
    let catalogVersion = '';
    for (const file of englishCatalogFiles) {
        const catalog = readJson(file);
        catalogVersion ||= catalog['@metadata']['catalog-version'];
        assert.equal(catalog['@metadata']['catalog-version'], catalogVersion);
        for (const key of Object.keys(catalog)) {
            if (key === '@metadata') continue;
            assert.equal(englishKeys.has(key), false, `duplicate English key: ${key}`);
            englishKeys.add(key);
        }
    }

    assert.ok(englishKeys.size > 300, 'expected the namespaced modern UI catalog to be included');
    for (const file of fs.readdirSync(langsRoot).filter((name) => /^[a-z]{2,3}(?:-[A-Za-z0-9]+)*\.json$/.test(name))) {
        const catalog = readJson(path.join(langsRoot, file));
        assert.equal(catalog['@metadata']['catalog-version'], catalogVersion, `${file} catalog version`);
        assert.equal(catalog['@metadata']['total-source-messages'], englishKeys.size, `${file} source total`);
        assert.ok(['source', 'partial', 'placeholder', 'complete'].includes(catalog['@metadata'].status));
    }
});

test('runtime loads English fallback for a regional locale and reports missing keys', async () => {
    const english = {
        '@metadata': { locale: 'en' },
        greeting: 'Hello $1',
        safeMarkup: '<strong>Ready</strong> $1'
    };
    const runtime = createRuntime({ '/en.json': english });
    const snapshot = await runtime.api.configure({
        requestedLocale: 'pt-BR',
        resolvedLocale: 'en',
        fallbackChain: ['pt-BR', 'pt', 'en'],
        direction: 'ltr',
        catalogVersion: 'test-1',
        namespaces: ['common'],
        assets: [{ locale: 'en', namespace: 'common', url: '/en.json' }]
    });

    assert.equal(snapshot.requestedLocale, 'pt-BR');
    assert.equal(snapshot.resolvedLocale, 'en');
    assert.deepEqual(Array.from(snapshot.fallbackChain), ['pt-BR', 'pt', 'en']);
    assert.equal(runtime.documentElement.lang, 'pt-BR');
    assert.equal(runtime.documentElement.dir, 'ltr');
    assert.equal(runtime.api.t('greeting', 'Fallback $1', 'Alex'), 'Hello Alex');
    assert.equal(runtime.api.t('missing.key', 'Fallback $1', 'value'), 'Fallback value');
    assert.equal(runtime.api.snapshot().missingKeyCount, 1);
    assert.deepEqual(Array.from(runtime.api.snapshot().recentMissingKeys), ['missing.key']);
    assert.equal(runtime.dispatchedEvents.at(-1).type, 'folderviewplus:i18n-ready');
    assert.ok(runtime.getTranslatedDomCount() >= 1);
    assert.ok(runtime.api.compare('Folder 2', 'Folder 10') < 0, 'locale comparison should use numeric collation');

    const pseudo = runtime.api.usePseudoLocale('ar-XB');
    assert.equal(pseudo.activeLocale, 'ar-XB');
    assert.equal(runtime.documentElement.dir, 'rtl');
    assert.match(runtime.api.t('safeMarkup'), /<strong>/, 'pseudo-localization must preserve markup tokens');
    const restored = runtime.api.restoreLocale();
    assert.equal(restored.activeLocale, 'pt-BR');
    assert.equal(restored.direction, 'ltr');
    assert.equal(runtime.documentElement.dir, 'ltr');
});

test('runtime preserves requested RTL direction while falling back to English', async () => {
    const runtime = createRuntime({ '/en.json': { '@metadata': {}, label: 'Label' } });
    await runtime.api.configure({
        requestedLocale: 'ar-SA',
        resolvedLocale: 'en',
        fallbackChain: ['ar-SA', 'ar', 'en'],
        direction: 'rtl',
        assets: [{ locale: 'en', namespace: 'legacy', url: '/en.json' }]
    });
    assert.equal(runtime.documentElement.lang, 'ar-SA');
    assert.equal(runtime.documentElement.dir, 'rtl');
    assert.equal(runtime.api.snapshot().direction, 'rtl');
});

test('runtime translates multiple text and attribute bindings independently', async () => {
    const runtime = createRuntime({
        '/en.json': {
            '@metadata': {},
            'settings.search.placeholder': 'Search settings',
            'settings.search.label': 'Search all plugin settings',
            'settings.tabs.basic': 'Basic',
            'settings.mode.basic-label': 'Use basic settings mode'
        }
    });
    await runtime.api.configure({
        requestedLocale: 'en',
        resolvedLocale: 'en',
        assets: [{ locale: 'en', namespace: 'settings', url: '/en.json' }]
    });
    const createNode = (binding, textContent = '', attributes = {}) => ({
        textContent,
        innerHTML: textContent,
        values: new Map(Object.entries({ 'data-i18n': binding, ...attributes })),
        matches: (selector) => selector === '[data-i18n]',
        querySelectorAll: () => [],
        getAttribute(name) { return this.values.get(name) || ''; },
        setAttribute(name, value) { this.values.set(name, String(value)); }
    });
    const search = createNode(
        '[placeholder]settings.search.placeholder;[aria-label]settings.search.label',
        '',
        { placeholder: 'Fallback search', 'aria-label': 'Fallback label' }
    );
    runtime.api.translate(search);
    assert.equal(search.getAttribute('placeholder'), 'Search settings');
    assert.equal(search.getAttribute('aria-label'), 'Search all plugin settings');

    const basic = createNode(
        'settings.tabs.basic;[aria-label]settings.mode.basic-label',
        'Fallback basic',
        { 'aria-label': 'Fallback basic label' }
    );
    runtime.api.translate(basic);
    assert.equal(basic.textContent, 'Basic');
    assert.equal(basic.getAttribute('aria-label'), 'Use basic settings mode');
});

test('server loader resolves full locale tags and support bundles include localization diagnostics', () => {
    const loader = fs.readFileSync(path.join(langsRoot, 'script.php'), 'utf8');
    const registry = fs.readFileSync(path.join(langsRoot, 'registry.php'), 'utf8');
    const diagnostics = fs.readFileSync(path.join(pluginRoot, 'server/lib.diagnostics.php'), 'utf8');
    const telemetry = fs.readFileSync(path.join(pluginRoot, 'scripts/folderviewplus.support-bundle-telemetry.js'), 'utf8');

    assert.doesNotMatch(loader, /substr\s*\([^\n]*locale/i);
    assert.match(loader, /fvplus_i18n_resolve_locale/);
    assert.match(loader, /namespaces\/en/);
    assert.match(registry, /\$rtlLanguages/);
    for (const field of ['requestedLocale', 'resolvedLocale', 'fallbackChain', 'catalogVersion', 'status']) {
        assert.match(diagnostics, new RegExp(`['"]${field}['"]`), `missing server localization field ${field}`);
    }
    assert.match(telemetry, /existingUiTelemetry\.localization/);
    assert.match(telemetry, /getLocalizationDiagnosticsSnapshot/);
});
