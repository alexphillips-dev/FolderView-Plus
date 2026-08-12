import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const profiles = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.theme-profiles.js');
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
