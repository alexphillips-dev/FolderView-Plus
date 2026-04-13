import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const dockerJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js');
const dockerRuntimeActionsJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.actions.js');
const vmJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/vm.js');

test('docker runtime actions refresh visible state in place instead of forcing a full reload', () => {
    assert.match(dockerJs, /refreshDockerRuntimeState:\s*\(options = \{\}\) => refreshDockerRuntimeStateInPlace\(options\)/);
    assert.match(dockerJs, /const refreshDockerRuntimeStateInPlace = async \(options = \{\}\) => \{/);
    assert.match(dockerJs, /queueLoadlistRefresh\(\{ suppressLoadingUi: true \}\);/);
    assert.match(dockerJs, /await refreshDockerRuntimeStateInPlace\(\{ followupDelayMs: 650 \}\);/);
    assert.match(dockerRuntimeActionsJs, /const refreshDockerRuntimeState = typeof deps\.refreshDockerRuntimeState === 'function'/);
    assert.match(dockerRuntimeActionsJs, /const queueDockerListRefresh = typeof deps\.queueLoadlistRefresh === 'function'/);
    assert.match(dockerRuntimeActionsJs, /const suspendDockerHostUpdateSync = typeof deps\.suspendDockerHostUpdateSync === 'function'/);
    assert.match(dockerRuntimeActionsJs, /const folderEvents = deps\.folderEvents && typeof deps\.folderEvents\.addEventListener === 'function'/);
    assert.match(dockerRuntimeActionsJs, /refreshDockerRuntimeState\(\{ followupDelayMs: 650 \}\)/);
    assert.match(dockerRuntimeActionsJs, /const DOCKER_DIALOG_REFRESH_CALLBACK_NAME = '__fvplusDockerDialogRefresh';/);
    assert.match(dockerRuntimeActionsJs, /const DOCKER_DIALOG_BACKSTOP_REFRESH_DELAYS_MS = \[3200,\s*9000\];/);
    assert.match(dockerRuntimeActionsJs, /const DOCKER_DIALOG_POST_RENDER_RECONCILE_WINDOW_MS = 120000;/);
    assert.match(dockerRuntimeActionsJs, /const runDockerDialogRefresh = \(\) => \{[\s\S]*refreshDockerList\(\);[\s\S]*refreshDockerRuntimeState\(\{\s*followupDelayMs: DOCKER_DIALOG_RUNTIME_REFRESH_FOLLOWUP_DELAY_MS\s*\}\)/);
    assert.match(dockerRuntimeActionsJs, /const queueDockerDialogPostRenderRefresh = \(\) => \{[\s\S]*refreshDockerRuntimeState\(\{\s*followupDelayMs: DOCKER_DIALOG_RUNTIME_REFRESH_FOLLOWUP_DELAY_MS\s*\}\)/);
    assert.match(dockerRuntimeActionsJs, /folderEvents\.addEventListener\('docker-post-folders-creation', \(\) => \{[\s\S]*queueDockerDialogPostRenderRefresh\(\);[\s\S]*\}\);/);
    assert.match(dockerRuntimeActionsJs, /const scheduleDockerDialogRefreshBackstops = \(\) => \{[\s\S]*refreshDockerRuntimeState\(\{\s*followupDelayMs: DOCKER_DIALOG_RUNTIME_REFRESH_FOLLOWUP_DELAY_MS\s*\}\)[\s\S]*queueDockerListRefresh\(\{ suppressLoadingUi: true \}\);/);
    assert.match(dockerRuntimeActionsJs, /const getDockerDialogRefreshCallbackName = \(\) => \{[\s\S]*win\[DOCKER_DIALOG_REFRESH_CALLBACK_NAME\] = \(\) => \{[\s\S]*runDockerDialogRefresh\(\);[\s\S]*\};[\s\S]*return DOCKER_DIALOG_REFRESH_CALLBACK_NAME;/);
    assert.match(dockerRuntimeActionsJs, /const openDockerFolderUpdateDialog = \(containersToUpdate,\s*title\) => \{[\s\S]*suspendDockerHostUpdateSync\(DOCKER_DIALOG_POST_RENDER_RECONCILE_WINDOW_MS\);[\s\S]*scheduleDockerDialogRefreshBackstops\(\);[\s\S]*openDockerDialog\('update_container ' \+ containersToUpdate,\s*title,\s*'',\s*getDockerDialogRefreshCallbackName\(\)\);/);
    assert.match(dockerJs, /queueLoadlistRefresh:\s*\(options = \{\}\) => queueLoadlistRefresh\(options\),/);
    assert.match(dockerJs, /folderEvents,\s*refreshDockerRuntimeState:\s*\(options = \{\}\) => refreshDockerRuntimeStateInPlace\(options\),\s*queueLoadlistRefresh:\s*\(options = \{\}\) => queueLoadlistRefresh\(options\),\s*suspendDockerHostUpdateSync:\s*\(durationMs = 0\) => suspendDockerHostUpdateSync\(durationMs\),/);
    assert.doesNotMatch(
        dockerRuntimeActionsJs,
        /const actionFolder = async \(id,\s*action,\s*\{ includeDescendants = true \} = \{\}\) => \{[\s\S]*?const errors = results\.filter\(\(entry\) => entry\?\.success !== true\);[\s\S]*?refreshDockerList\(\);[\s\S]*?\};/
    );
});

test('vm runtime and folder settings actions use the debounced reload queue instead of direct loadlist calls', () => {
    assert.match(vmJs, /const actionFolder = async \(id,\s*action,\s*\{ includeDescendants = true \} = \{\}\) => \{[\s\S]*?queueLoadlistRefresh\(\);[\s\S]*?\};/);
    assert.match(vmJs, /const folderCustomAction = async \(id,\s*action\) => \{[\s\S]*?await Promise\.all\(prom\);[\s\S]*?queueLoadlistRefresh\(\);[\s\S]*?\};/);
    assert.match(vmJs, /const cloneVmFolderFromMenu = async \(id\) => \{[\s\S]*?queueLoadlistRefresh\(\);[\s\S]*?\};/);
    assert.match(vmJs, /const pasteVmFolderSettingsFromMenu = async \(id\) => \{[\s\S]*?queueLoadlistRefresh\(\);[\s\S]*?\};/);
    assert.ok(vmJs.includes("await $.post('/plugins/folderview.plus/server/sync_order.php', { type: 'vm' }).promise();"));
    assert.ok(vmJs.includes('swal.close();'));
});
