import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const tools = require('./lib/i18n_surface_tools.cjs');
const repoRoot = path.resolve(process.cwd());
const pluginDir = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus');
const langDir = path.join(pluginDir, 'langs');
const namespaceRoot = path.join(langDir, 'namespaces');
const catalogVersion = process.env.FVPLUS_I18N_CATALOG_VERSION || '2026.07.19.2';
const translateMissing = process.argv.includes('--translate');
const locales = fs.readdirSync(langDir)
    .filter((name) => /^[a-z]{2,3}(?:-[A-Za-z0-9]+)*\.json$/.test(name))
    .map((name) => name.replace(/\.json$/, ''))
    .sort((left, right) => left === 'en' ? -1 : (right === 'en' ? 1 : left.localeCompare(right)));
const targetLocales = Object.freeze({
    cs: 'cs', de: 'de', es: 'es', fr: 'fr', it: 'it', ja: 'ja', ko: 'ko', nl: 'nl', pl: 'pl',
    'pt-BR': 'pt', 'pt-PT': 'pt', ro: 'ro', ru: 'ru', sv: 'sv', tr: 'tr', uk: 'uk', 'zh-Hans': 'zh-CN'
});

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 4)}\n`, 'utf8');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const placeholderSignature = (value) => (String(value || '').match(/\$\d+/g) || []).sort().join('|');
const protectPlaceholders = (value) => String(value || '').replace(/\$(\d+)/g, '__FVPLUS_PARAM_$1__');
const restorePlaceholders = (value) => String(value || '').replace(/__FVPLUS_PARAM_(\d+)__/gi, '$$$1');
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
    for (const [key, english] of Object.entries(englishMessages)) {
        const prior = existing[key];
        if (typeof prior === 'string' && prior.trim() && placeholderSignature(prior) === placeholderSignature(english)) messages[key] = prior;
        else missing.push([key, english]);
    }
    if (locale === 'en') return englishMessages;
    if (missing.length > 0 && !translateMissing) {
        throw new Error(`${locale} is missing ${missing.length} surface translations; rerun with --translate.`);
    }
    for (const batch of batchesFor(missing)) Object.assign(messages, await translateBatch(batch, targetLocales[locale] || locale));
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

const namespaceNames = fs.readdirSync(path.join(namespaceRoot, 'en')).filter((name) => name.endsWith('.json')).sort();
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
    rootCatalog['@metadata']['last-updated'] = '2026-07-19';
    rootCatalog['@metadata']['last-reviewed'] = '2026-07-19';
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
    'generated-at': '2026-07-19',
    'candidate-count': 0,
    'auto-bound-message-count': phrases.length,
    'catalog-message-count': aggregateCount,
    description: 'All detected initial and runtime-written legacy UI text is represented by the generated legacy-surface namespace.',
    'largest-surfaces': largestSurfaces
});

console.log(`Built ${phrases.length} auto-bound surface messages across ${locales.length} locales; aggregate catalog ${aggregateCount} messages.`);
