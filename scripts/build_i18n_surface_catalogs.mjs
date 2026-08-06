import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const tools = require('./lib/i18n_surface_tools.cjs');
const OpenCC = require('opencc-js');
const repoRoot = path.resolve(process.cwd());
const pluginDir = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus');
const langDir = path.join(pluginDir, 'langs');
const namespaceRoot = path.join(langDir, 'namespaces');
const catalogVersion = process.env.FVPLUS_I18N_CATALOG_VERSION || '2026.08.06.1';
const catalogDate = process.env.FVPLUS_I18N_CATALOG_DATE || new Date().toISOString().slice(0, 10);
const translateMissing = process.argv.includes('--translate');
const scaffoldArgument = process.argv.find((argument) => argument.startsWith('--scaffold='));
const requestedScaffolds = scaffoldArgument
    ? scaffoldArgument.slice('--scaffold='.length).split(',').map((locale) => locale.trim()).filter(Boolean)
    : [];
const retranslateEnglishArgument = process.argv.find((argument) => argument.startsWith('--retranslate-english='));
const retranslateEnglishLocales = new Set(retranslateEnglishArgument
    ? retranslateEnglishArgument.slice('--retranslate-english='.length).split(',').map((locale) => locale.trim()).filter(Boolean)
    : []);
const retranslateMatchesArgument = process.argv.find((argument) => argument.startsWith('--retranslate-matches='));
const retranslateMatchLocales = new Map((retranslateMatchesArgument
    ? retranslateMatchesArgument.slice('--retranslate-matches='.length).split(',')
    : []).map((pair) => pair.split(':').map((locale) => locale.trim())).filter((pair) => pair.length === 2 && pair.every(Boolean)));
const targetLocales = Object.freeze({
    ar: 'ar', bn: 'bn', ca: 'ca', cs: 'cs', da: 'da', de: 'de', es: 'es', fr: 'fr', hr: 'hr', hu: 'hu',
    it: 'it', ja: 'ja', ko: 'ko', lv: 'lv', nb: 'no', nl: 'nl', pl: 'pl', 'pt-BR': 'pt', 'pt-PT': 'pt',
    ro: 'ro', ru: 'ru', sv: 'sv', tr: 'tr', uk: 'uk', 'zh-Hans': 'zh-CN', 'zh-Hant': 'zh-TW'
});
const traditionalChineseNormalizationProfile = 'opencc-s2twp-1.4.1';
const normalizeTraditionalChinese = OpenCC.Converter({ from: 'cn', to: 'twp' });
const scaffoldDefinitions = Object.freeze({
    ar: { direction: 'rtl', nativeName: 'العربية' },
    bn: { direction: 'ltr', nativeName: 'বাংলা' },
    ca: { direction: 'ltr', nativeName: 'Català' },
    da: { direction: 'ltr', nativeName: 'Dansk' },
    hr: { direction: 'ltr', nativeName: 'Hrvatski' },
    hu: { direction: 'ltr', nativeName: 'Magyar' },
    lv: { direction: 'ltr', nativeName: 'Latviešu' },
    nb: { direction: 'ltr', nativeName: 'Norsk bokmål' },
    'zh-Hant': { direction: 'ltr', nativeName: '繁體中文' }
});

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 4)}\n`, 'utf8');
const scaffoldLocale = (locale) => {
    const definition = scaffoldDefinitions[locale];
    if (!definition) throw new Error(`No scaffold definition is registered for ${locale}.`);
    const rootFile = path.join(langDir, `${locale}.json`);
    if (!fs.existsSync(rootFile)) {
        writeJson(rootFile, {
            '@metadata': {
                authors: ['FolderView Plus maintainers'],
                'catalog-version': catalogVersion,
                direction: definition.direction,
                'last-reviewed': null,
                'last-updated': catalogDate,
                locale,
                'native-name': definition.nativeName,
                reviewed: false,
                'source-revision': '',
                status: 'partial',
                'translated-messages': 0,
                'total-source-messages': 1
            }
        });
    }
    const localeNamespaceRoot = path.join(namespaceRoot, locale);
    fs.mkdirSync(localeNamespaceRoot, { recursive: true });
    for (const file of fs.readdirSync(path.join(namespaceRoot, 'en')).filter((name) => name.endsWith('.json'))) {
        const namespaceFile = path.join(localeNamespaceRoot, file);
        if (fs.existsSync(namespaceFile)) continue;
        writeJson(namespaceFile, {
            '@metadata': {
                'catalog-version': catalogVersion,
                locale,
                namespace: path.basename(file, '.json')
            }
        });
    }
    console.log(`Scaffolded ${locale}.`);
};
for (const locale of requestedScaffolds) scaffoldLocale(locale);
const locales = fs.readdirSync(langDir)
    .filter((name) => /^[a-z]{2,3}(?:-[A-Za-z0-9]+)*\.json$/.test(name))
    .map((name) => name.replace(/\.json$/, ''))
    .sort((left, right) => left === 'en' ? -1 : (right === 'en' ? 1 : left.localeCompare(right)));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const placeholderSignature = (value) => (
    [...new Set(String(value || '').match(/\$\d+/g) || [])].sort().join('|')
);
const protectPlaceholders = (value) => String(value || '').replace(/\$(\d+)/g, '__FVPLUS_PARAM_$1__');
const restorePlaceholders = (value) => String(value || '').replace(/__FVPLUS_PARAM_(\d+)__/gi, '$$$1');
const normalizeLocaleMessages = (locale, messages) => locale === 'zh-Hant'
    ? Object.fromEntries(Object.entries(messages).map(([key, value]) => [key, normalizeTraditionalChinese(value)]))
    : messages;
const shouldRetranslate = (locale, current, english, comparison) => (
    (retranslateEnglishLocales.has(locale) && current === english)
    || (retranslateMatchLocales.has(locale) && current === comparison)
);
const { byPhrase, fileCounts } = tools.collectSurfaceCandidates(pluginDir);
const phrases = [...byPhrase.keys()].sort((left, right) => left.localeCompare(right));
const englishMessages = Object.fromEntries(phrases.map((phrase) => [tools.keyForPhrase(phrase), phrase]));

const batchesFor = (entries, maxChars = 4200) => {
    const batches = [];
    let current = [];
    let size = 0;
    for (const entry of entries) {
        const nextSize = entry[1].length + 32;
        if (current.length > 0 && size + nextSize > maxChars) {
            batches.push(current);
            current = [];
            size = 0;
        }
        current.push(entry);
        size += nextSize;
    }
    if (current.length > 0) batches.push(current);
    return batches;
};
const reviewBatchesFor = (entries, locale) => batchesFor(
    entries,
    retranslateEnglishLocales.has(locale) || retranslateMatchLocales.has(locale) ? 600 : 4200
);

const translateBatch = async (batch, target, attempt = 1) => {
    const sentinels = batch.slice(1).map((_entry, index) => `__FVPLUS_${String(index + 1).padStart(4, '0')}__`);
    const payload = batch.map((entry, index) => {
        const protectedValue = protectPlaceholders(entry[1]);
        return index === 0 ? protectedValue : `${sentinels[index - 1]}\n${protectedValue}`;
    }).join('\n');
    const url = new URL('https://translate.googleapis.com/translate_a/single');
    url.searchParams.set('client', 'gtx');
    url.searchParams.set('sl', 'en');
    url.searchParams.set('tl', target);
    url.searchParams.set('dt', 't');
    url.searchParams.set('q', payload);
    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': 'FolderView-Plus-localization-builder/1.0' },
            signal: AbortSignal.timeout(15000)
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const translated = Array.isArray(data?.[0]) ? data[0].map((segment) => String(segment?.[0] || '')).join('') : '';
        const parts = sentinels.length === 0
            ? [restorePlaceholders(translated.trim())]
            : translated.split(new RegExp(`\\s*(?:${sentinels.join('|')})\\s*`, 'g')).map((value) => restorePlaceholders(value.trim()));
        if (parts.length === batch.length && parts.some((value) => !value) && batch.length > 1) {
            const output = {};
            for (let index = 0; index < batch.length; index += 1) {
                const [key] = batch[index];
                if (parts[index]) output[key] = parts[index];
                else Object.assign(output, await translateBatch([batch[index]], target));
            }
            return output;
        }
        if (parts.length !== batch.length || parts.some((value) => !value)) {
            if (batch.length > 1) {
                const midpoint = Math.ceil(batch.length / 2);
                return {
                    ...await translateBatch(batch.slice(0, midpoint), target),
                    ...await translateBatch(batch.slice(midpoint), target)
                };
            }
            throw new Error(`translation batch returned ${parts.length}/${batch.length} segments for ${JSON.stringify(batch[0]?.[1] || '')}`);
        }
        return Object.fromEntries(batch.map(([key], index) => [key, parts[index]]));
    } catch (error) {
        if (attempt >= 3) throw error;
        await sleep(300 * (2 ** attempt));
        return translateBatch(batch, target, attempt + 1);
    }
};

const buildLocaleMessages = async (locale) => {
    const file = path.join(namespaceRoot, locale, 'legacy-surface.json');
    const existing = fs.existsSync(file) ? readJson(file) : {};
    const messages = {};
    const missing = [];
    const comparisonLocale = retranslateMatchLocales.get(locale);
    const comparison = comparisonLocale
        ? readJson(path.join(namespaceRoot, comparisonLocale, 'legacy-surface.json'))
        : {};
    for (const [key, english] of Object.entries(englishMessages)) {
        const prior = existing[key];
        if (
            typeof prior === 'string'
            && prior.trim()
            && placeholderSignature(prior) === placeholderSignature(english)
            && !shouldRetranslate(locale, prior, english, comparison[key])
        ) messages[key] = prior;
        else missing.push([key, english]);
    }
    if (locale === 'en') return englishMessages;
    if (missing.length > 0 && !translateMissing) {
        throw new Error(`${locale} is missing ${missing.length} surface translations; rerun with --translate.`);
    }
    for (const batch of reviewBatchesFor(missing, locale)) {
        Object.assign(messages, normalizeLocaleMessages(locale, await translateBatch(batch, targetLocales[locale] || locale)));
    }
    return Object.fromEntries(Object.entries(messages).sort(([left], [right]) => left.localeCompare(right)));
};

const built = new Map();
const workers = Math.min(3, locales.length);
let cursor = 0;
await Promise.all(Array.from({ length: workers }, async () => {
    while (cursor < locales.length) {
        const locale = locales[cursor++];
        const messages = await buildLocaleMessages(locale);
        built.set(locale, messages);
        const dir = path.join(namespaceRoot, locale);
        fs.mkdirSync(dir, { recursive: true });
        writeJson(path.join(dir, 'legacy-surface.json'), {
            '@metadata': { 'catalog-version': catalogVersion, locale, namespace: 'legacy-surface' },
            ...messages
        });
        console.log(`Completed ${locale}: ${Object.keys(messages).length} surface messages.`);
    }
}));

const englishRootCatalog = readJson(path.join(langDir, 'en.json'));
const englishRootEntries = Object.entries(englishRootCatalog).filter(([key, value]) => (
    key !== '@metadata' && typeof value === 'string'
));
for (const locale of locales.filter((name) => name !== 'en')) {
    const rootFile = path.join(langDir, `${locale}.json`);
    const catalog = readJson(rootFile);
    const comparisonLocale = retranslateMatchLocales.get(locale);
    const comparison = comparisonLocale ? readJson(path.join(langDir, `${comparisonLocale}.json`)) : {};
    const missing = englishRootEntries.filter(([key, english]) => (
        typeof catalog[key] !== 'string'
        || !catalog[key].trim()
        || placeholderSignature(catalog[key]) !== placeholderSignature(english)
        || shouldRetranslate(locale, catalog[key], english, comparison[key])
    ));
    if (missing.length > 0 && !translateMissing) {
        throw new Error(`${locale}.json is missing ${missing.length} legacy translations; rerun with --translate.`);
    }
    for (const batch of reviewBatchesFor(missing, locale)) {
        Object.assign(catalog, normalizeLocaleMessages(locale, await translateBatch(batch, targetLocales[locale] || locale)));
    }
    writeJson(rootFile, Object.fromEntries([
        ['@metadata', catalog['@metadata']],
        ...englishRootEntries.map(([key]) => [key, catalog[key]])
    ]));
    if (missing.length > 0) {
        console.log(`Completed ${locale}.json: translated ${missing.length} missing messages.`);
    }
}

const namespaceNames = fs.readdirSync(path.join(namespaceRoot, 'en')).filter((name) => name.endsWith('.json')).sort();
for (const namespaceName of namespaceNames.filter((name) => name !== 'legacy-surface.json')) {
    const englishCatalog = readJson(path.join(namespaceRoot, 'en', namespaceName));
    const englishEntries = Object.entries(englishCatalog).filter(([key, value]) => (
        key !== '@metadata' && typeof value === 'string'
    ));
    for (const locale of locales.filter((name) => name !== 'en')) {
        const namespaceFile = path.join(namespaceRoot, locale, namespaceName);
        const catalog = readJson(namespaceFile);
        const comparisonLocale = retranslateMatchLocales.get(locale);
        const comparison = comparisonLocale
            ? readJson(path.join(namespaceRoot, comparisonLocale, namespaceName))
            : {};
        const missing = englishEntries.filter(([key, english]) => (
            typeof catalog[key] !== 'string'
            || !catalog[key].trim()
            || placeholderSignature(catalog[key]) !== placeholderSignature(english)
            || shouldRetranslate(locale, catalog[key], english, comparison[key])
        ));
        if (missing.length > 0 && !translateMissing) {
            throw new Error(`${locale}/${namespaceName} is missing ${missing.length} translations; rerun with --translate.`);
        }
        for (const batch of reviewBatchesFor(missing, locale)) {
            Object.assign(catalog, normalizeLocaleMessages(locale, await translateBatch(batch, targetLocales[locale] || locale)));
        }
        const ordered = Object.fromEntries([
            ['@metadata', catalog['@metadata']],
            ...englishEntries.map(([key]) => [key, catalog[key]])
        ]);
        writeJson(namespaceFile, ordered);
        if (missing.length > 0) {
            console.log(`Completed ${locale}/${namespaceName}: translated ${missing.length} missing messages.`);
        }
    }
}

const traditionalRoot = path.join(langDir, 'zh-Hant.json');
if (fs.existsSync(traditionalRoot)) {
    const traditionalCatalog = readJson(traditionalRoot);
    if (traditionalCatalog['@metadata']?.['normalization-profile'] !== traditionalChineseNormalizationProfile) {
        for (const file of [
            traditionalRoot,
            ...fs.readdirSync(path.join(namespaceRoot, 'zh-Hant'))
                .filter((name) => name.endsWith('.json'))
                .map((name) => path.join(namespaceRoot, 'zh-Hant', name))
        ]) {
            const catalog = readJson(file);
            for (const [key, value] of Object.entries(catalog)) {
                if (key !== '@metadata' && typeof value === 'string') {
                    catalog[key] = normalizeTraditionalChinese(value);
                }
            }
            if (file === traditionalRoot) {
                catalog['@metadata']['normalization-profile'] = traditionalChineseNormalizationProfile;
            }
            writeJson(file, catalog);
        }
        console.log(`Normalized zh-Hant with ${traditionalChineseNormalizationProfile}.`);
    }
}

let aggregateCount = 0;
for (const namespaceName of namespaceNames) {
    const catalog = readJson(path.join(namespaceRoot, 'en', namespaceName));
    aggregateCount += Object.keys(catalog).filter((key) => key !== '@metadata').length;
}
aggregateCount += Object.keys(readJson(path.join(langDir, 'en.json'))).filter((key) => key !== '@metadata').length;

for (const locale of locales) {
    const rootFile = path.join(langDir, `${locale}.json`);
    const rootCatalog = readJson(rootFile);
    rootCatalog['@metadata']['catalog-version'] = catalogVersion;
    rootCatalog['@metadata']['source-revision'] = catalogVersion;
    rootCatalog['@metadata']['last-updated'] = catalogDate;
    rootCatalog['@metadata']['last-reviewed'] = catalogDate;
    rootCatalog['@metadata']['translated-messages'] = aggregateCount;
    rootCatalog['@metadata']['total-source-messages'] = aggregateCount;
    writeJson(rootFile, rootCatalog);
    for (const namespaceName of namespaceNames) {
        const namespaceFile = path.join(namespaceRoot, locale, namespaceName);
        const catalog = readJson(namespaceFile);
        catalog['@metadata']['catalog-version'] = catalogVersion;
        writeJson(namespaceFile, catalog);
    }
}

const largestSurfaces = Object.fromEntries(Object.entries(fileCounts).sort((left, right) => right[1] - left[1]).slice(0, 10));
writeJson(path.join(langDir, 'extraction-report.json'), {
    'catalog-version': catalogVersion,
    'generated-at': catalogDate,
    'candidate-count': 0,
    'auto-bound-message-count': phrases.length,
    'catalog-message-count': aggregateCount,
    description: 'All detected initial and runtime-written legacy UI text is represented by the generated legacy-surface namespace.',
    'largest-surfaces': largestSurfaces
});

console.log(`Built ${phrases.length} auto-bound surface messages across ${locales.length} locales; aggregate catalog ${aggregateCount} messages.`);
