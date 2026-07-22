import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const repoRoot = path.resolve(process.cwd());
const require = createRequire(import.meta.url);
const surfaceTools = require(path.join(repoRoot, 'scripts/lib/i18n_surface_tools.cjs'));
const pluginRoot = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus');
const langsRoot = path.join(pluginRoot, 'langs');
const namespacesRoot = path.join(langsRoot, 'namespaces');
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const messagesOnly = (catalog) => Object.fromEntries(Object.entries(catalog).filter(([key]) => key !== '@metadata'));
const parameters = (value) => (String(value || '').match(/\$\d+/g) || []).sort();

test('every detected legacy UI phrase is represented by one stable generated key', () => {
    const surface = surfaceTools.collectSurfaceCandidates(pluginRoot);
    const english = messagesOnly(readJson(path.join(namespacesRoot, 'en/legacy-surface.json')));
    const expected = Object.fromEntries([...surface.byPhrase.keys()].sort().map((phrase) => [surfaceTools.keyForPhrase(phrase), phrase]));

    assert.equal(surface.byPhrase.size, 1594);
    assert.deepEqual(english, expected);
    assert.equal(new Set(Object.keys(english)).size, surface.byPhrase.size);
});

test('all shipped surface catalogs are complete and preserve runtime parameters', () => {
    const english = messagesOnly(readJson(path.join(namespacesRoot, 'en/legacy-surface.json')));
    const englishKeys = Object.keys(english).sort();
    const locales = fs.readdirSync(namespacesRoot).filter((entry) => fs.statSync(path.join(namespacesRoot, entry)).isDirectory());

    assert.equal(locales.length, 18);
    for (const locale of locales) {
        const catalog = messagesOnly(readJson(path.join(namespacesRoot, locale, 'legacy-surface.json')));
        assert.deepEqual(Object.keys(catalog).sort(), englishKeys, `${locale} surface keys must match English`);
        for (const key of englishKeys) {
            assert.equal(typeof catalog[key], 'string', `${locale}/${key} must be text`);
            assert.notEqual(catalog[key].trim(), '', `${locale}/${key} must not be blank`);
            assert.deepEqual(parameters(catalog[key]), parameters(english[key]), `${locale}/${key} parameters`);
        }
    }
});

test('the extraction report and runtime enforce zero-debt initial and dynamic coverage', () => {
    const report = readJson(path.join(langsRoot, 'extraction-report.json'));
    const runtime = fs.readFileSync(path.join(pluginRoot, 'scripts/folderviewplus.i18n.js'), 'utf8');
    const builder = fs.readFileSync(path.join(repoRoot, 'scripts/build_i18n_surface_catalogs.mjs'), 'utf8');
    const loader = fs.readFileSync(path.join(langsRoot, 'script.php'), 'utf8');

    assert.equal(report['catalog-version'], '2026.07.22.1');
    assert.equal(report['candidate-count'], 0);
    assert.equal(report['auto-bound-message-count'], 1594);
    assert.equal(report['catalog-message-count'], 2006);
    assert.match(runtime, /rebuildAutoPhraseIndex/);
    assert.match(runtime, /resolveAutoTranslation/);
    assert.match(runtime, /observeDynamicTranslations/);
    assert.match(runtime, /new root\.MutationObserver/);
    assert.match(runtime, /data-fvplus-user-content/);
    assert.match(builder, /protectPlaceholders/);
    assert.match(builder, /placeholderSignature/);
    assert.match(builder, /AbortSignal\.timeout/);
    assert.match(loader, /in_array\('legacy-surface', \$requestedNamespaces/);
});
