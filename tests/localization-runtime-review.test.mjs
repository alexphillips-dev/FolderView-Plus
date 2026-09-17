import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const tools = require('../scripts/lib/i18n_surface_tools.cjs');
const plugin = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus');
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const review = read('scripts/lib/i18n_reviewed_runtime.json');
const terms = read('scripts/lib/i18n_reviewed_terms.json');
const workflows = read('scripts/lib/i18n_reviewed_workflows.json');
const params = (text) => [...new Set(text.match(/\$\d+/g) || [])].sort();

test('reviewed runtime messages cover every supported locale and preserve all interpolation arguments', () => {
    const locales = fs.readdirSync(path.join(plugin, 'langs/namespaces')).filter(locale => locale !== 'en').sort();
    assert.deepEqual(Object.keys(review.locales).sort(), locales);
    assert.deepEqual(Object.keys(terms.locales).sort(), locales);
    assert.deepEqual(Object.keys(terms.iconNames).sort(), locales);
    assert.deepEqual(Object.keys(workflows.locales).sort(), locales);
    const english = read(path.join(plugin, 'langs/namespaces/en/common.json'));
    for (const locale of locales) {
        const catalog = read(path.join(plugin, `langs/namespaces/${locale}/common.json`));
        assert.equal(review.locales[locale].length, review.keys.length, locale);
        assert.equal(workflows.locales[locale].length, workflows.terms.length, locale);
        workflows.terms.forEach((phrase, index) => assert.deepEqual(params(workflows.locales[locale][index]), params(phrase), `${locale}/${phrase}`));
        review.keys.forEach((key, index) => {
            const value = review.locales[locale][index];
            assert.ok(value.trim(), `${locale}/${key}`);
            assert.deepEqual(params(value), params(english[key]), `${locale}/${key}`);
            assert.equal(catalog[key], value, `${locale}/${key} must retain reviewed wording`);
        });
        const englishSurface = read(path.join(plugin, 'langs/namespaces/en/legacy-surface.json'));
        const surface = read(path.join(plugin, `langs/namespaces/${locale}/legacy-surface.json`));
        for (const phrase of ['Order', 'Manual', 'All states', 'Pack', 'Include shown', 'Exclude shown']) {
            const key = Object.keys(englishSurface).find(key => englishSurface[key] === phrase);
            assert.equal(surface[key], terms.locales[locale][terms.terms.indexOf(phrase)], `${locale}/${phrase}`);
        }
    }
});

test('conditional runtime bindings are extracted while user input values are excluded', () => {
    const phrase = 'Select items first';
    const source = `label = selected ? '' : surfaceT('${tools.keyForPhrase(phrase)}', '${phrase}');`;
    assert.ok(tools.extractFileCandidates(source).some(row => row.value === phrase));
    assert.throws(() => tools.extractFileCandidates("surfaceT('legacy.surface.0000000000000000', 'Wrong key')"), /Invalid surface binding/);
    const values = tools.extractFileCandidates('<input type="button" value="Save as copy"><input type="text" value="Private folder name"><option value="Private identifier">').map(row => row.value);
    assert.deepEqual(values, ['Save as copy']);
});

test('every explicit surface binding resolves to its English source without losing parameters', () => {
    const english = Object.assign({}, read(path.join(plugin, 'langs/en.json')), ...fs.readdirSync(path.join(plugin, 'langs/namespaces/en')).map(file => read(path.join(plugin, 'langs/namespaces/en', file))));
    for (const file of tools.collectSourceFiles(plugin)) {
        const source = fs.readFileSync(file, 'utf8');
        for (const match of source.matchAll(/\b(?:surfaceT|translateVmText)\("((?:common\.(?:runtime|icons)|legacy\.surface)\.[^"]+)", ("(?:\\.|[^"\\])*")/g)) {
            assert.equal(tools.normalizePhrase(english[match[1]]), tools.normalizePhrase(JSON.parse(match[2])), `${file}/${match[1]}`);
        }
    }
});
