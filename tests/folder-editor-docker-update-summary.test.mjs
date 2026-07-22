import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const repoRoot = path.resolve(process.cwd());
const require = createRequire(import.meta.url);
const dockerTypeModule = require(path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.type-docker.js'
));
const folderJs = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.js'),
    'utf8'
);
const folderTypeDockerJs = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.type-docker.js'),
    'utf8'
);
const settingsJs = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-health.js'),
    'utf8'
) + '\n' + fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js'),
    'utf8'
);

test('modern folder editor update summary accepts normalized update flags from member inventory', () => {
    assert.match(folderJs, /const isDockerUpdateAvailableInEditor = \(member\) => \{/);
    assert.match(folderJs, /if \(source\.UpdateAvailable === true \|\| source\.update === true\) \{\s*return true;\s*\}/);
    assert.match(folderJs, /const state = source\?\.State \|\| source\?\.RawState \|\| source\?\.info\?\.State \|\| \{\};/);
    assert.match(folderTypeDockerJs, /const getPreviewSignals = \(\{ selectedMembers = \[\] \} = \{\}\) =>/);
    assert.match(folderTypeDockerJs, /const updateCount = members\.filter\(\(member\) => isDockerUpdateAvailableInEditor\(member\)\)\.length;/);
    assert.match(folderTypeDockerJs, /const buildSmartDefaultSuggestions = \(\{ selectedMembers = \[\],\s*form \} = \{\}\) =>/);
    assert.match(folderJs, /const typeSuggestions = getFolderEditorTypeApi\(\)\?\.buildSmartDefaultSuggestions\?\.\(\{/);
});

test('shared docker update helper accepts normalized update flags outside the Docker page runtime', () => {
    assert.match(settingsJs, /const isDockerUpdateAvailable = \(itemInfo\) => \{/);
    assert.match(settingsJs, /if \(source\.UpdateAvailable === true \|\| source\.update === true\) \{\s*return true;\s*\}/);
    assert.match(settingsJs, /const isDockerUpdateAvailable = \(\.\.\.args\) => getSettingsHealthApi\(\)\.isDockerUpdateAvailable\(\.\.\.args\);/);
});

test('Docker smart defaults expose only suggestions that apply a real editor change', () => {
    const form = { preview_update: { checked: false } };
    const api = dockerTypeModule.createApi({
        isDockerUpdateAvailableInEditor: (member) => member.UpdateAvailable === true
    });
    const suggestions = api.buildSmartDefaultSuggestions({
        selectedMembers: [
            { ComposeProject: 'media', UpdateAvailable: true },
            { ComposeProject: 'media', UpdateAvailable: false }
        ],
        form
    });

    assert.deepEqual(suggestions.map((entry) => entry.key), ['updates']);
    assert.equal(typeof suggestions[0].apply, 'function');
    suggestions[0].apply();
    assert.equal(form.preview_update.checked, true);
    assert.equal(Object.hasOwn(api, 'applyPreviewConstraints'), false);
});

test('modern folder editor docker mapper accepts lightweight state-mode read_info entries', () => {
    const api = dockerTypeModule.createApi({
        getFolderLabelValue: (labels) => labels['net.unraid.docker.folder'] || '',
        getComposeProjectFromLabels: (labels) => labels['com.docker.compose.project'] || ''
    });
    const member = api.mapRuntimeMember({
        name: 'qbittorrentvpn',
        Labels: {
            'net.unraid.docker.icon': '/plugins/folderview.plus/images/qbit.png',
            'net.unraid.docker.folder': 'Downloads',
            'com.docker.compose.project': 'media'
        },
        state: 'running',
        running: true,
        paused: false,
        autostart: true,
        manager: 'dockerman',
        Updated: false
    });

    assert.equal(member.Name, 'qbittorrentvpn');
    assert.equal(member.Icon, '/plugins/folderview.plus/images/qbit.png');
    assert.equal(member.Label, 'Downloads');
    assert.equal(member.ComposeProject, 'media');
    assert.equal(member.State.Running, true);
    assert.equal(member.State.Autostart, true);
    assert.equal(member.State.Status, 'running');
    assert.equal(member.UpdateAvailable, true);
});

test('modern folder editor live preview prefers current runtime booleans over stale status text', () => {
    assert.match(folderJs, /const resolveMemberRuntimeStateKey = \(member\) => \{/);
    assert.match(folderJs, /const hasExplicitPaused = typeof source\.Paused === 'boolean' \|\| typeof source\.paused === 'boolean' \|\| typeof source\.pause === 'boolean';/);
    assert.match(folderJs, /const hasExplicitRunning = typeof source\.Running === 'boolean' \|\| typeof source\.running === 'boolean' \|\| typeof source\.state === 'boolean';/);
    assert.match(folderJs, /if \(hasExplicitPaused \|\| hasExplicitRunning\) \{[\s\S]*return 'stopped';[\s\S]*\}/);
    assert.match(folderJs, /const runtimeStateKey = resolveMemberRuntimeStateKey\(member\);/);

    const api = dockerTypeModule.createApi({
        getFolderLabelValue: () => '',
        getComposeProjectFromLabels: () => ''
    });
    const stalePausedMember = api.mapRuntimeMember({
        name: 'tautulli',
        Labels: {},
        State: {
            Running: true,
            Paused: false,
            Status: 'paused'
        }
    });
    const staleStartedMember = api.mapRuntimeMember({
        name: 'seekandwatch',
        Labels: {},
        State: {
            Running: false,
            Paused: false,
            Status: 'running'
        }
    });

    assert.equal(stalePausedMember.State.Running, true);
    assert.equal(stalePausedMember.State.Paused, false);
    assert.equal(stalePausedMember.State.Status, 'running');
    assert.equal(staleStartedMember.State.Running, false);
    assert.equal(staleStartedMember.State.Paused, false);
    assert.equal(staleStartedMember.State.Status, 'stopped');
});
