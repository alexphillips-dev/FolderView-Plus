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

    // Theme and rule-preview messages retain semantic keys after retiring obsolete source surfaces.
    assert.ok(surface.byPhrase.size >= 2993, 'retain the audited conditional UI surfaces');
    const settings = readJson(path.join(namespacesRoot, 'en/settings.json'));
    for (const key of ['settings.navigation.themes', 'settings.theme.manager-help', 'settings.theme.host-default', 'settings.theme.managed-layer', 'settings.theme.host-status']) {
        assert.ok(settings[key], `replacement semantic message must exist: ${key}`);
    }
    const common = readJson(path.join(namespacesRoot, 'en/common.json'));
    for (const key of ['common.server.rules-preview-changed', 'common.server.rules-preview-invalid', 'common.repair.rules-preview-moves-manual']) assert.ok(common[key]);
    assert.deepEqual(english, expected);
    assert.equal(new Set(Object.keys(english)).size, surface.byPhrase.size);
});

test('all shipped surface catalogs are complete and preserve runtime parameters', () => {
    const english = messagesOnly(readJson(path.join(namespacesRoot, 'en/legacy-surface.json')));
    const englishKeys = Object.keys(english).sort();
    const locales = fs.readdirSync(namespacesRoot).filter((entry) => fs.statSync(path.join(namespacesRoot, entry)).isDirectory());

    assert.equal(locales.length, 27);
    for (const locale of locales) {
        const settings = readJson(path.join(namespacesRoot, locale, 'settings.json'));
        assert.match(settings['settings.theme.host-default'], /Unraid/, `${locale} preserves the host product name`);
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

    assert.equal(report['catalog-version'], '2026.08.10.1');
    assert.equal(report['candidate-count'], 0);
    assert.equal(report['auto-bound-message-count'], surfaceTools.collectSurfaceCandidates(pluginRoot).byPhrase.size);
    const catalogs = [readJson(path.join(langsRoot, 'en.json')), ...fs.readdirSync(path.join(namespacesRoot, 'en')).map(file => readJson(path.join(namespacesRoot, 'en', file)))];
    assert.equal(report['catalog-message-count'], new Set(catalogs.flatMap(catalog => Object.keys(messagesOnly(catalog)))).size);
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

test('every explicit Start Order key is shipped in every locale catalog', () => {
    const viewSource = fs.readFileSync(path.join(pluginRoot, 'scripts/folderviewplus.start-order-view.js'), 'utf8');
    const referencedKeys = [...viewSource.matchAll(/startOrderT\(\s*['"]([^'"]+)['"]/g)].map((match) => match[1]);
    const locales = fs.readdirSync(namespacesRoot).filter((entry) => fs.statSync(path.join(namespacesRoot, entry)).isDirectory());

    assert.equal(new Set(referencedKeys).size, 27);
    for (const locale of locales) {
        const catalog = readJson(path.join(namespacesRoot, locale, 'settings.json'));
        for (const key of referencedKeys) {
            assert.equal(typeof catalog[key], 'string', `${locale}/${key} must be present`);
            assert.notEqual(catalog[key].trim(), '', `${locale}/${key} must not be blank`);
        }
    }
});
