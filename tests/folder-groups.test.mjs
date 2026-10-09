import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const plugin = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus');
const utils = require(path.join(plugin, 'scripts/folderviewplus.utils.js'));
const groupsApi = require(path.join(plugin, 'scripts/folderviewplus.folder-groups.js'));
const group = { id: 'custom:sample', name: ' Home lab ', folders: [
    { name: ' Media ', icon: '/plugins/folderview.plus/images/icons/folder-media.svg' },
    { name: 'media', icon: 'javascript:bad' },
    { name: 'Monitoring', icon: 'https://user:password@example.invalid/icon.png' },
    { name: 'Inline icon', icon: 'data:image/png;base64,YWJj' }
] };

test('folder groups normalize reusable blueprints without copying memberships or arbitrary settings', () => {
    const normalized = utils.normalizeFolderGroups([group, group, null, { ...group, id: 'builtin:reserved' }]);
    assert.deepEqual(normalized, [{ id: 'custom:sample', name: 'Home lab', folders: [
        { name: 'Media', icon: '/plugins/folderview.plus/images/icons/folder-media.svg' },
        { name: 'Monitoring', icon: '/plugins/folderview.plus/images/folder-icon.png' },
        { name: 'Inline icon', icon: 'data:image/png;base64,YWJj' }
    ] }]);
    assert.equal(utils.normalizePrefs({ folderGroups: normalized }).folderGroups.length, 1);
    assert.deepEqual(utils.normalizePrefs({}).folderGroups, []);
    assert.equal(utils.normalizeFolderGroups(Array.from({ length: 40 }, (_, index) => ({ ...group, id: `custom:${index}` }))).length, 30);
    assert.equal(utils.normalizeFolderGroups([{ ...group, folders: Array.from({ length: 60 }, (_, index) => ({ name: `Folder ${index}` })) }])[0].folders.length, 50);
});

test('group creation skips existing names and duplicates without replacing folder configuration', () => {
    const existing = { one: { name: ' Media ', containers: ['keep'], settings: { preview: 2 } } };
    const result = groupsApi.planCreates([{ name: 'media' }, { name: 'Books' }, { name: 'BOOKS' }], existing);
    assert.deepEqual(result, { creates: [{ name: 'Books' }], skipped: 2 });
    assert.deepEqual(existing.one.containers, ['keep']);
    assert.equal(existing.one.settings.preview, 2);
});

test('server normalization, guarded persistence, type separation and group deletion agree with browser preferences', () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-group-test-'));
    const quote = value => `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
    const harness = `<?php
    $_SERVER['DOCUMENT_ROOT'] = getenv('FVPLUS_TEST_DOCUMENT_ROOT');
    require_once ${quote(path.join(plugin, 'server/lib.php'))};
    require_once ${quote(path.join(plugin, 'server/lib.validation.php'))};
    $groups = json_decode(${quote(JSON.stringify([group, group]))}, true);
    $prefs = normalizeTypePrefs(['folderGroups' => $groups]);
    fvplus_assert_prefs_payload_shape(['folderGroups' => $groups]);
    writeTypePrefs('docker', $prefs);
    $saved = readTypePrefs('docker');
    $vm = readTypePrefs('vm');
    $sanitized = diagnosticsBuildStateSnapshot('vm', [], $saved, [], 'sanitized');
    $deleted = normalizeTypePrefs(mergeTypePrefsPatch($saved, ['folderGroups' => []]));
    $rejected = false;
    try { fvplus_assert_prefs_payload_shape(['folderGroups' => array_fill(0, 31, $groups[0])]); }
    catch (Throwable $error) { $rejected = true; }
    echo json_encode(['saved' => $saved['folderGroups'], 'vm' => $vm['folderGroups'], 'deleted' => $deleted['folderGroups'], 'rejected' => $rejected, 'sanitized' => $sanitized]);`;
    const file = path.join(temp, 'groups.php');
    fs.mkdirSync(path.join(temp, 'document-root'));
    fs.writeFileSync(file, harness);
    try {
        const result = JSON.parse(execFileSync('php', [file], { encoding: 'utf8', env: {
            ...process.env, FVPLUS_TEST_CONFIG_DIR: path.join(temp, 'config'),
            FVPLUS_TEST_SOURCE_DIR: path.join(temp, 'runtime'), FVPLUS_TEST_DOCUMENT_ROOT: path.join(temp, 'document-root')
        } }));
        assert.deepEqual(result.saved, utils.normalizeFolderGroups([group]));
        assert.deepEqual(result.vm, []);
        assert.deepEqual(result.deleted, []);
        assert.equal(result.rejected, true);
        assert.doesNotMatch(JSON.stringify(result.sanitized), /Home lab|Monitoring|custom:sample|folder-media/);
    } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
