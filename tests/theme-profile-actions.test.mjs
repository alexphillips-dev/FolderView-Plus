import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const themeWorkspaceModule = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.theme-workspace.js');
const updatePlanPhp = fs.readFileSync('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.theme-update-plan.php', 'utf8');
const actionsPhp = fs.readFileSync('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.theme-profile-actions.php', 'utf8');
const bulkUpdatePhp = fs.readFileSync('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.theme-bulk-update.php', 'utf8');
const endpointPhp = fs.readFileSync('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/theme_workspace.php', 'utf8');
const endpointManifest = JSON.parse(fs.readFileSync('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/api-endpoints.json', 'utf8'));

test('profile customization previews the update plan before its atomic save', async () => {
    const calls = [];
    const workspace = {
        schemaVersion: 2,
        activeProfileId: 'default',
        profiles: [{ id: 'default', name: 'Default', layers: { global: { variables: { '--fvplus-theme-accent': '#123456' }, customCss: '' } } }]
    };
    const api = themeWorkspaceModule.createApi({
        apiPostJson: async (_url, payload) => {
            calls.push(payload);
            return payload.action === 'preview_profile' ? { plan: { changed: true, changedScopes: ['docker', 'vm', 'dashboard'] } } : { workspace };
        }
    });
    api.setWorkspace(workspace);
    await api.saveCustomize();
    assert.deepEqual(calls.map((call) => call.action), ['preview_profile', 'save_profile']);
    assert.equal(calls[1].profileId, 'default');
    assert.equal(calls[1].scope, 'global');
});

test('theme update transaction snapshots workspace and all generated assets and restores on failure', () => {
    assert.match(updatePlanPhp, /fvplusThemeUpdateSnapshotPaths\(\$persistWorkspace\)/);
    assert.match(updatePlanPhp, /catch \(Throwable \$error\) \{\s*fvplusThemeUpdateRestoreFiles\(\$snapshots\);/);
    assert.match(updatePlanPhp, /withConfigMutationLock/);
    assert.match(updatePlanPhp, /writeThemeWorkspaceManagedAssetsUnprotected/);
});

test('profile endpoint exposes preview separately from guarded mutations', () => {
    assert.match(actionsPhp, /function createThemeWorkspaceProfile/);
    assert.match(actionsPhp, /function prepareThemeWorkspaceProfileLayer/);
    assert.match(endpointPhp, /preview_profile/);
    assert.match(endpointPhp, /save_profile/);
    const actions = endpointManifest.endpoints['theme_workspace.php'].actions;
    assert.equal(actions.preview_profile.access, 'read-only');
    assert.equal(actions.save_profile.requestToken, 'mutation');
    assert.equal(actions.delete_profile.requestToken, 'mutation');
});

test('managed theme batch updates fetch every replacement before one atomic workspace write', () => {
    assert.match(bulkUpdatePhp, /function prepareThemeWorkspaceThemeUpdates/);
    assert.match(bulkUpdatePhp, /function updateThemeWorkspaceThemes/);
    assert.match(bulkUpdatePhp, /fvplusImportGithubThemeFiles/);
    assert.match(bulkUpdatePhp, /return \['workspace' => writeThemeWorkspace\(\$workspace\), 'plan' => \$plan\];/);
    const actions = endpointManifest.endpoints['theme_workspace.php'].actions;
    assert.equal(actions.preview_theme_updates.access, 'read-only');
    assert.equal(actions.update_themes.requestToken, 'mutation');
});
