import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { collectSourceFiles } = require('../scripts/lib/i18n_surface_tools.cjs');
const pluginPath = 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus';
const generator = path.resolve('scripts/build_i18n_surface_catalogs.mjs');
const reviewedFile = 'scripts/lib/i18n_additional_surfaces.json';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, catalog) => fs.writeFileSync(file, JSON.stringify(catalog, null, 4) + '\n');

test('catalog generation preserves review dates and limits a wording edit to its source catalogs', (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-catalog-generation-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const copy = (file) => {
        const dest = path.join(root, file);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(file, dest);
    };
    fs.cpSync(path.join(pluginPath, 'langs'), path.join(root, pluginPath, 'langs'), { recursive: true });
    for (const file of collectSourceFiles(pluginPath)) copy(file);
    for (const { locations } of read(reviewedFile)) for (const { file } of locations) copy(path.join(pluginPath, file));
    for (const file of fs.readdirSync('scripts/lib').filter(file => /^i18n_.*\.json$/.test(file))) {
        copy(path.join('scripts/lib', file));
    }
    const langRoot = path.join(root, pluginPath, 'langs');
    const watch = fs.readdirSync(langRoot, { recursive: true }).filter(file => file.endsWith('.json'))
        .map(file => file.replaceAll(path.sep, '/')).sort();
    const snapshot = () => Object.fromEntries(watch.map(relativePath => {
        const file = path.join(langRoot, relativePath);
        return [relativePath, { contents: fs.readFileSync(file, 'utf8'), mtime: fs.statSync(file).mtimeMs }];
    }));
    const run = date => spawnSync(process.execPath, [generator], {
        cwd: root, encoding: 'utf8', env: { ...process.env, FVPLUS_I18N_CATALOG_DATE: date },
        timeout: 45000
    });

    const baseline = snapshot();
    const unchanged = run('2042-03-14');
    assert.equal(unchanged.status, 0, unchanged.stderr);
    assert.deepEqual(snapshot(), baseline);

    const settingsPath = path.join(langRoot, 'namespaces/da/settings.json');
    const catalog = read(settingsPath);
    const key = 'settings.operations.runtime-unconfirmed';
    catalog[key] = 'Syntetisk tekst til afprøvning.';
    write(settingsPath, catalog);
    const changed = run('2042-03-15');
    assert.equal(changed.status, 0, changed.stderr);
    const after = snapshot();
    assert.deepEqual(watch.filter(file => after[file].contents !== baseline[file].contents), ['da.json', 'namespaces/da/settings.json']);
    const metadata = read(path.join(langRoot, 'da.json'))['@metadata'];
    assert.equal(read(settingsPath)[key], catalog[key]);
    assert.equal(metadata['last-updated'], '2042-03-15');
    assert.equal(metadata['last-reviewed'], JSON.parse(baseline['da.json'].contents)['@metadata']['last-reviewed']);

    delete catalog[key];
    write(settingsPath, catalog);
    const beforeFailure = snapshot();
    const missing = run('2042-03-16');
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /da\/settings\.json is missing 1 translations/);
    assert.deepEqual(snapshot(), beforeFailure);
});
