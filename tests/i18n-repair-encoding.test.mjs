import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const plugin = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus');
const keys = [
    'common.repair.applying-items-in-one-atomic-request-items-1-a8179d',
    'common.repair.applying-one-atomic-request-items-1-31551b',
    'common.repair.applying-folder-changes-in-one-transaction-changes-1-17d06c',
    'common.repair.1-items-2-818040',
    'common.repair.1-smart-rule-scan-suggestions-found-2-f5de01'
];
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const parameters = text => (text.match(/\$\d+/g) || []).sort();

test('repair message source and runtime fallbacks contain no replacement characters', () => {
    const messages = read('scripts/lib/i18n_repair_messages.json');
    for (const key of keys) assert.equal(messages[key].includes('\uFFFD'), false, key);
    for (const file of ['folderviewplus.bulk-assignment.js', 'folderviewplus.import.js', 'folderviewplus.js']) {
        assert.equal(fs.readFileSync(path.join(plugin, 'scripts', file), 'utf8').includes('\uFFFD'), false, file);
    }
});

test('every generated locale keeps repaired messages and their interpolation parameters intact', () => {
    const messages = read('scripts/lib/i18n_repair_messages.json');
    const locales = fs.readdirSync(path.join(plugin, 'langs/namespaces'), { withFileTypes: true }).filter(entry => entry.isDirectory());
    assert.ok(locales.length > 1);
    for (const locale of locales) {
        const catalog = read(path.join(plugin, 'langs/namespaces', locale.name, 'common.json'));
        for (const key of keys) {
            assert.equal(typeof catalog[key], 'string', `${locale.name}/${key}`);
            assert.equal(catalog[key].includes('\uFFFD'), false, `${locale.name}/${key}`);
            assert.deepEqual(parameters(catalog[key]), parameters(messages[key]), `${locale.name}/${key}`);
        }
    }
});
