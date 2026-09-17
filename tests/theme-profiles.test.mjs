import test from 'node:test';
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
        $copied = createThemeWorkspaceProfile('Blue Docker', 'default', 'docker', ['--fvplus-theme-accent' => '#3b82f6'], '.docker-draft { opacity: .8; }');
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
        assert.equal(original.layers.global.variables['--fvplus-theme-accent'], '#123456');
        assert.equal(copy.layers.global.variables['--fvplus-theme-accent'], '#123456');
        assert.equal(copy.layers.docker.variables['--fvplus-theme-accent'], '#3b82f6');
        assert.match(copy.layers.docker.customCss, /docker-draft/);
        assert.match(copy.layers.vm.customCss, /vm-saved/);
        assert.equal(result.rejected, true);
        assert.equal(result.unchanged, true);
    } finally { fs.rmSync(sandbox, { recursive: true, force: true }); }
});
