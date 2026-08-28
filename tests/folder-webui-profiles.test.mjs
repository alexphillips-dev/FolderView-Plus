import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const profiles = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.webui-profiles.js');

test('normalizes profile identities, names, and selected members', () => {
    const normalized = profiles.normalizeProfiles([
        { id: 'media', name: ' Media ', containers: ['Plex', 'Plex', '', 'Tautulli'] },
        { id: 'media', name: '', members: ['Overseerr'] },
        null
    ]);
    assert.deepEqual(normalized, [
        { id: 'media', name: 'Media', containers: ['Plex', 'Tautulli'] },
        { id: 'media-2', name: 'Profile 2', containers: ['Overseerr'] }
    ]);
});

test('resolves only currently eligible selected WebUIs and deduplicates URLs', () => {
    const result = profiles.collectProfileTargets({
        id: 'media', name: 'Media', containers: ['Plex', 'Tautulli', 'Missing', 'Stopped']
    }, {
        Plex: { name: 'Plex', state: true, pause: false, webui: 'http://plex/' },
        Tautulli: { state: true, pause: false, WebUi: 'http://plex/' },
        Stopped: { state: false, pause: false, webui: 'http://stopped/' },
        Other: { state: true, pause: false, webui: 'http://other/' }
    }, {
        getSafeWebuiUrl: (value) => /^https?:/.test(value) ? value : '',
        runningOnly: true
    });
    assert.deepEqual(result.urls, ['http://plex/']);
    assert.equal(result.selectedCount, 4);
    assert.equal(result.eligibleCount, 1);
    assert.equal(result.unavailableCount, 1);
});

test('renames profile targets and strips profiles from transferable settings', () => {
    assert.deepEqual(profiles.renameProfileMember([
        { id: 'media', name: 'Media', containers: ['Plex', 'Tautulli'] }
    ], 'Plex', 'Plex-Media'), [
        { id: 'media', name: 'Media', containers: ['Plex-Media', 'Tautulli'] }
    ]);
    assert.deepEqual(profiles.stripProfilesFromSettings({
        preview: 2,
        webui_profiles: [{ id: 'media' }],
        webuiProfiles: [{ id: 'legacy' }]
    }), { preview: 2 });
});

test('diagnostic summary contains counts only', () => {
    assert.deepEqual(profiles.summarizeProfiles([
        { id: 'media', name: 'Media', containers: ['Plex', 'Missing'] }
    ], ['Plex']), {
        profileCount: 1,
        selectedReferenceCount: 2,
        unavailableReferenceCount: 1,
        duplicateProfileIdCount: 0,
        invalidProfileCount: 0
    });
});
