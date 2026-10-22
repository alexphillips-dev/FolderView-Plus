import test from 'node:test';
import { runCaptureFixture } from './helpers/transaction-capture.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const profiles = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.theme-profiles.js');
const presets = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.theme-workspace.js');
const serverProfiles = fs.readFileSync('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.theme-profiles.php', 'utf8');
const workspaceServer = fs.readFileSync('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.theme-workspace.php', 'utf8');
const coreServer = fs.readFileSync('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.php', 'utf8');

test('legacy Theme Workspace customization migrates into a default global profile', () => {
    const state = profiles.normalizeState({ variables: { '--accent': '#fff' }, customCss: '.legacy {}' });
    assert.equal(state.activeProfileId, 'default');
    assert.deepEqual(state.profiles[0].layers.global, { variables: { '--accent': '#fff' }, customCss: '.legacy {}' });
    assert.deepEqual(state.profiles[0].layers.docker, { variables: {}, customCss: '' });
});

test('profile resolution overlays a surface layer on global values', () => {
    const workspace = {
        activeProfileId: 'night',
        profiles: [{
            id: 'night',
            name: 'Night',
            layers: {
                global: { variables: { '--accent': '#111', '--shared': '#222' }, customCss: '.global {}' },
                docker: { variables: { '--accent': '#333' }, customCss: '.docker {}' }
            }
        }]
    };
    assert.deepEqual(profiles.resolveLayer(workspace, 'docker'), {
        variables: { '--accent': '#333', '--shared': '#222' },
        customCss: '.global {}\n\n.docker {}'
    });
});

test('server profile schema preserves compatibility aliases and scoped asset generation', () => {
    assert.match(coreServer, /FVPLUS_THEME_WORKSPACE_SCHEMA_VERSION = 2/);
    assert.match(serverProfiles, /function fvplusThemeProfilesNormalizeState/);
    assert.match(serverProfiles, /function fvplusThemeProfilesWithCompatibilityAliases/);
    assert.match(workspaceServer, /fvplusThemeProfileResolvedLayer\(\$normalized, \$type\)/);
    assert.match(workspaceServer, /'activeProfileId'\s*=>\s*\$profileState\['activeProfileId'\]/);
});

test('color presets replace only accent/graph values and inherited removes those overrides', () => {
    const layer = { variables: { '--fvplus-theme-accent': '#123456', '--fvplus-status-stopped': '#ff0000' }, customCss: '.saved { opacity: .9; }' };
    const blue = presets.applyPresetToLayer(layer, 'blue');
    assert.equal(blue.variables['--fvplus-theme-accent'], '#3b82f6');
    assert.equal(blue.variables['--fvplus-status-stopped'], '#ff0000');
    assert.equal(blue.customCss, layer.customCss);
    assert.equal(layer.variables['--fvplus-theme-accent'], '#123456');
    assert.deepEqual(presets.applyPresetToLayer(blue, 'inherited'), { variables: { '--fvplus-status-stopped': '#ff0000' }, customCss: layer.customCss });
    assert.throws(() => presets.applyPresetToLayer(layer, '__proto__'), /Unknown/);
});

test('save-as-profile copies other scopes, persists the selected draft and rejects unsafe CSS without changes', () => {
    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-profile-copy-'));
    const quote = value => `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
    for (const dir of ['config', 'source', 'document-root']) fs.mkdirSync(path.join(sandbox, dir));
    const php = `
        require_once ${quote(path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.php'))};
        $workspace = defaultThemeWorkspace();
        $workspace['profiles'][0]['layers']['global']['variables'] = ['--fvplus-theme-accent' => '#123456'];
        $workspace['profiles'][0]['layers']['vm']['customCss'] = '.vm-saved { opacity: .9; }';
        writeThemeWorkspace($workspace);
        $copied = createThemeWorkspaceProfile(str_repeat('p', 95) . '😀', 'default', 'docker', ['--fvplus-theme-accent' => '#3b82f6'], '.docker-draft { opacity: .8; }');
        $before = file_get_contents(getThemeWorkspacePath());
        $rejected = false;
        try { createThemeWorkspaceProfile('Unsafe', 'default', 'docker', [], '@import url(https://example.invalid/private.css);'); }
        catch (RuntimeException $error) { $rejected = true; }
        echo json_encode(['copied' => $copied, 'saved' => readThemeWorkspace(), 'rejected' => $rejected, 'unchanged' => $before === file_get_contents(getThemeWorkspacePath())]);
    `;
    try {
        const result = JSON.parse(execFileSync('php', ['-r', php], { encoding: 'utf8', env: {
            ...process.env, FVPLUS_TEST_CONFIG_DIR: path.join(sandbox, 'config'), FVPLUS_TEST_SOURCE_DIR: path.join(sandbox, 'source'), FVPLUS_TEST_DOCUMENT_ROOT: path.join(sandbox, 'document-root')
        } }));
        const original = result.saved.profiles.find(profile => profile.id === 'default');
        const copy = result.saved.profiles.find(profile => profile.id === result.saved.activeProfileId);
        assert.equal(copy.name, 'p'.repeat(95), 'multibyte profile names must remain serializable at the byte limit');
        assert.equal(original.layers.global.variables['--fvplus-theme-accent'], '#123456');
        assert.equal(copy.layers.global.variables['--fvplus-theme-accent'], '#123456');
        assert.equal(copy.layers.docker.variables['--fvplus-theme-accent'], '#3b82f6');
        assert.match(copy.layers.docker.customCss, /docker-draft/);
        assert.match(copy.layers.vm.customCss, /vm-saved/);
        assert.equal(result.rejected, true);
        assert.equal(result.unchanged, true);
    } finally { fs.rmSync(sandbox, { recursive: true, force: true }); }
});
test('theme rollback distinguishes empty/missing assets and restores captured modes', () => {
    const result = runCaptureFixture('roundtrip', 'theme');
    assert.equal(result.same, true);
    assert.equal(result.emptyExists, true);
    assert.equal(result.emptyBytes, '');
    assert.equal(result.missingExists, false);
});

test('managed theme actions persist independently of customization layers and generate the correct page assets', () => {
    const sandbox = fs.mkdtempSync(path.join(process.cwd(), 'tmp', 'fvplus-theme-actions-'));
    const quote = value => `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
    for (const dir of ['config', 'source', 'document-root']) fs.mkdirSync(path.join(sandbox, dir));
    const php = `
        require_once ${quote(path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.php'))};
        $workspace = defaultThemeWorkspace();
        $workspace['themes'] = [
            ['id' => 'first', 'name' => 'First', 'source' => ['canCheckUpdates' => false], 'files' => [
                ['path' => 'docker.css', 'content' => '.first-docker { opacity: .9; }', 'tabs' => ['docker']]]],
            ['id' => 'second', 'name' => 'Second', 'source' => ['canCheckUpdates' => false], 'files' => [
                ['path' => 'vm.css', 'content' => '.second-vm { opacity: .8; }', 'tabs' => ['vm']]]]
        ];
        $workspace['activeThemeId'] = 'first';
        $workspace['profiles'][0]['layers']['global']['variables'] = ['--fvplus-theme-accent' => '#123456'];
        $workspace['profiles'][0]['layers']['docker']['customCss'] = '.custom-docker { opacity: .7; }';
        writeThemeWorkspace($workspace);
        $assets = static function(): array {
            $result = [];
            foreach (['docker', 'vm', 'dashboard'] as $scope) $result[$scope] = file_get_contents(fvplusThemeWorkspaceGeneratedCssPath($scope));
            return $result;
        };
        $first = $assets();
        deactivateThemeWorkspaceTheme();
        $disabled = $assets();
        activateThemeWorkspaceTheme('second');
        $second = $assets();
        $checked = checkThemeWorkspaceUpdates();
        $deleted = deleteThemeWorkspaceTheme('second');
        $before = file_get_contents(getThemeWorkspacePath());
        $rejected = false;
        try { activateThemeWorkspaceTheme('missing'); } catch (RuntimeException $error) { $rejected = true; }
        echo json_encode(['first' => $first, 'disabled' => $disabled, 'second' => $second, 'checked' => $checked,
            'deleted' => $deleted, 'persisted' => readThemeWorkspace(), 'rejected' => $rejected,
            'unchanged' => $before === file_get_contents(getThemeWorkspacePath())]);
    `;
    try {
        const result = JSON.parse(execFileSync('php', ['-r', php], { encoding: 'utf8', env: {
            ...process.env, FVPLUS_TEST_CONFIG_DIR: path.join(sandbox, 'config'), FVPLUS_TEST_SOURCE_DIR: path.join(sandbox, 'source'),
            FVPLUS_TEST_DOCUMENT_ROOT: path.join(sandbox, 'document-root')
        } }));
        assert.match(result.first.docker, /first-docker/);
        for (const scope of ['docker', 'vm', 'dashboard']) assert.match(result.first[scope], /--fvplus-custom-theme-accent: #123456/);
        assert.doesNotMatch(result.first.vm, /first-docker/);
        for (const stage of ['disabled', 'second']) {
            for (const scope of ['docker', 'vm', 'dashboard']) assert.match(result[stage][scope], /--fvplus-theme-accent: #123456/);
            assert.match(result[stage].docker, /custom-docker/);
            assert.doesNotMatch(result[stage].vm, /custom-docker/);
        }
        assert.doesNotMatch(result.disabled.docker, /first-docker/);
        assert.match(result.second.vm, /second-vm/);
        assert.doesNotMatch(result.second.dashboard, /second-vm/);
        assert.equal(result.checked.updateCount, 0);
        assert.equal(result.persisted.activeThemeId, '');
        assert.equal(result.persisted.themes.length, 1);
        assert.equal(result.persisted.profiles[0].layers.global.variables['--fvplus-theme-accent'], '#123456');
        assert.equal(result.rejected && result.unchanged, true);
    } finally { fs.rmSync(sandbox, { recursive: true, force: true }); }
});
