import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const phpPath = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.webui-profiles.php');
const phpQuote = (value) => `'${String(value).replaceAll('\\', '/').replaceAll("'", "\\'")}'`;
const runPhp = (expression) => JSON.parse(execFileSync('php', ['-r',
    `require ${phpQuote(phpPath)}; echo json_encode(${expression}, JSON_UNESCAPED_SLASHES);`
], { encoding: 'utf8' }));

test('server normalizes WebUI profiles and enforces unique identities and names', () => {
    const result = runPhp(`fvplusNormalizeWebuiProfiles([
        ['id'=>'media','name'=>'Media','containers'=>['Plex','Plex','Tautulli']],
        ['id'=>'media','name'=>'Media','members'=>['Overseerr']]
    ])`);
    assert.deepEqual(result, [
        { id: 'media', name: 'Media', containers: ['Plex', 'Tautulli'] },
        { id: 'media-2', name: 'Media 2', containers: ['Overseerr'] }
    ]);
});

test('server diagnostics expose aggregate counts without profile or member values', () => {
    const result = runPhp(`fvplusBuildWebuiProfileDiagnostics([
        'webui_profiles'=>[['id'=>'media','name'=>'Media','containers'=>['Plex','Missing']]]
    ], ['Plex'])`);
    assert.deepEqual(result, {
        profileCount: 1,
        selectedReferenceCount: 2,
        unavailableReferenceCount: 1,
        duplicateProfileIdCount: 0,
        invalidProfileCount: 0
    });
    assert.doesNotMatch(JSON.stringify(result), /Plex|Missing|Media/);
});

test('generic settings transfer strips member-bound WebUI profiles', () => {
    const result = runPhp(`fvplusStripWebuiProfilesFromSettings([
        'preview'=>2,
        'webui_profiles'=>[['id'=>'media']],
        'webuiProfiles'=>[['id'=>'legacy']]
    ])`);
    assert.deepEqual(result, { preview: 2 });
});

test('ordinary Docker saves reject overlong profile names and overlarge selection without changing the saved folder', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-webui-validation-'));
    const config = path.join(root, 'config');
    const host = path.join(root, 'host');
    fs.mkdirSync(config);
    fs.mkdirSync(host);
    try {
        const script = `
            define('FVPLUS_CONFIG_ONLY_BOOTSTRAP', true);
            $_SERVER['DOCUMENT_ROOT'] = getenv('FVPLUS_TEST_DOCUMENT_ROOT');
            require ${phpQuote(path.join(path.dirname(phpPath), 'lib.php'))};
            $memberNames = array_map(static fn($n) => "container-$n", range(1, 250));
            $name = str_repeat('界', 26);
            $folder = ['name' => 'Fixture', 'settings' => ['webui_profiles' => [
                ['id'=>'a','name'=>"$name A",'containers'=>$memberNames],
                ['id'=>'b','name'=>"$name B",'containers'=>['container-1']]
            ]]];
            updateFolder('docker', json_encode($folder));
            $original = readRawFolderMap('docker');
            $id = (string)array_key_first($original);
            $revision = readConfigMetadata('docker', true)['folderRevision'];
            $attempts = [];
            foreach (['name', 'members'] as $field) {
                $invalid = $folder;
                if ($field === 'name') $invalid['settings']['webui_profiles'][0]['name'] = str_repeat('界', 27) . ' A';
                else $invalid['settings']['webui_profiles'][0]['containers'][] = 'container-251';
                foreach (['create', 'update'] as $action) {
                    try { updateFolder('docker', json_encode($invalid), $action === 'create' ? '' : $id, $revision); }
                    catch (InvalidArgumentException $error) { $attempts[] = [$field, $action]; }
                }
            }
            $saved = readRawFolderMap('docker');
            echo json_encode(['attempts'=>$attempts, 'unchanged'=>$saved === $original && $revision === readConfigMetadata('docker', true)['folderRevision'],
                'profiles'=>$saved[$id]['settings']['webui_profiles']]);
        `;
        const result = JSON.parse(execFileSync('php', ['-r', script], { encoding: 'utf8', env: {
            ...process.env, FVPLUS_TEST_CONFIG_DIR: config, FVPLUS_TEST_STORAGE_DIR: config,
            FVPLUS_TEST_SOURCE_DIR: root, FVPLUS_TEST_DOCUMENT_ROOT: host
        } }));
        assert.deepEqual(result.attempts, [['name', 'create'], ['name', 'update'], ['members', 'create'], ['members', 'update']]);
        assert.equal(result.unchanged, true);
        assert.deepEqual(result.profiles.map(profile => profile.name), ['界'.repeat(26) + ' A', '界'.repeat(26) + ' B']);
        assert.equal(result.profiles[0].containers.length, 250);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
