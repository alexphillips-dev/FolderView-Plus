import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import test from 'node:test';
const require = createRequire(import.meta.url);
const root = 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus';
const schema = JSON.parse(fs.readFileSync(`${root}/schemas/folder-settings-transfer.schema.json`, 'utf8'));
const module = require(`../${root}/scripts/folder.settings-transfer.js`);
const run = request => {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-settings-transfer-'));
    try {
        for (const name of ['config', 'source', 'host']) fs.mkdirSync(path.join(temporary, name));
        const file = path.join(temporary, 'request.json'); fs.writeFileSync(file, JSON.stringify(request));
        const env = { ...process.env, FVPLUS_TEST_CONFIG_DIR: path.join(temporary, 'config'), FVPLUS_TEST_SOURCE_DIR: path.join(temporary, 'source'),
            FVPLUS_TEST_STORAGE_DIR: temporary, FVPLUS_TEST_DOCUMENT_ROOT: path.join(temporary, 'host') };
        return JSON.parse(execFileSync('php', [path.resolve('tests/fixtures/folder-settings-transfer.php'), path.resolve(root, 'server'), file], { env, encoding: 'utf8', timeout: 15000 }));
    } finally {
        assert.equal(path.dirname(path.resolve(temporary)), path.resolve(os.tmpdir()));
        assert.ok(path.basename(temporary).startsWith('fvplus-settings-transfer-'));
        fs.rmSync(temporary, { recursive: true, force: true });
    }
};
for (const type of ['docker', 'vm']) for (const category of schema.categories) {
    test(`${type} selective ${category} paste preserves every other category and skips a repeat without writes`, () => {
        const result = run({ type, categories: [category] });
        assert.equal(result.error, '');
        assert.deepEqual(result.afterPreview, result.before, 'preview must not write');
        assert.equal(result.result.updatedCount, 1);
        assert.equal(result.backups.length, 1);
        assert.equal(result.repeat.updatedCount, 0);
        assert.equal(result.repeat.backup, null);
        assert.deepEqual(result.afterRepeat, result.after, 'identical paste must not write files or revisions');
        const before = result.original, after = result.target;
        for (const field of ['name', 'parentId', 'containers', 'regex', 'createdAt']) assert.deepEqual(after[field], before[field]);
        for (const field of schema.protectedSettings) assert.deepEqual(after.settings[field], before.settings[field]);
        const api = module.createApi({ schema });
        for (const [key, value] of Object.entries(before.settings)) if (api.categoryForKey(key) !== category) assert.deepEqual(after.settings[key], value, key);
        if (category !== 'actions') assert.deepEqual(after.actions, before.actions);
        if (category !== 'appearance') assert.equal(after.icon, before.icon);
        if (category === 'actions') assert.deepEqual(after.actions.map(action => action.name), ['Script']);
    });
}
test('all categories preserve identity and member-specific settings while applying the portable categories', () => {
    const result = run({ categories: schema.categories });
    assert.equal(result.error, '');
    assert.deepEqual(result.target.containers, result.original.containers);
    assert.deepEqual(result.target.settings.webui_profiles, result.original.settings.webui_profiles);
    assert.equal(result.target.settings.preview, 4);
    assert.equal(result.target.settings.expand_tab, true);
    assert.equal(result.target.icon, 'source.svg');
    assert.equal(result.repeat.updatedCount, 0);
});
test('stale previews fail before a safety backup or settings overwrite', () => {
    const result = run({ scenario: 'stale' });
    assert.match(result.error, /changed|revision|conflict/i);
    assert.equal(result.backups.length, 0);
    assert.equal(result.target.icon, result.original.icon);
    assert.equal(result.target.settings.expand_tab, true);
});
test('JS and PHP use the same category registry for every editor setting and alias', () => {
    const source = fs.readFileSync(`${root}/scripts/folder.js`, 'utf8');
    const payload = source.slice(source.indexOf('const buildFolderPayloadFromForm ='), source.indexOf('const buildFolderSettingsSummaryHtml ='));
    const keys = [...new Set([...payload.matchAll(/^\s+(\w+):/gm)].map(match => match[1]))];
    keys.push(...schema.protectedSettings, 'future_setting', 'previewFutureSetting', 'override_default_actions');
    const api = module.createApi({ schema });
    assert.deepEqual(run({ scenario: 'preview', keys }).categoryKeys, keys.map(key => api.categoryForKey(key)));
});
test('backup failure prevents the paste and preserves the stored configuration', () => {
    const result = run({ scenario: 'backup-failure' });
    assert.ok(result.error);
    assert.equal(result.backups.length, 0);
    assert.deepEqual(result.target, result.original);
    assert.deepEqual(result.after, result.before);
});
test('invalid categories and missing targets fail atomically before a backup or folder update', () => {
    for (const request of [{ categories: [] }, { categories: ['appearance', 'unknown'] }, { targetIds: ['target', 'missing'] }, { targetIds: [123] }]) {
        const result = run(request);
        assert.ok(result.error);
        assert.equal(result.backups.length, 0);
        assert.deepEqual(result.after, result.before);
        assert.deepEqual(result.target, result.original);
    }
});
