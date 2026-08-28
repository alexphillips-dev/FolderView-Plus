import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
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
