import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const dockerJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js');
const dockerRuntimeActionsJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.actions.js');
const vmJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/vm.js');
const runtimeNativeActions = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/runtime.native-actions.js');

test('docker runtime actions refresh visible state in place instead of forcing a full reload', () => {
    const dialogRefreshSource = dockerRuntimeActionsJs.slice(
        dockerRuntimeActionsJs.indexOf('const runDockerDialogRefresh ='),
        dockerRuntimeActionsJs.indexOf('const scheduleDockerDialogRefreshBackstops =')
    );
    const dialogBackstopSource = dockerRuntimeActionsJs.slice(
        dockerRuntimeActionsJs.indexOf('const scheduleDockerDialogRefreshBackstops ='),
        dockerRuntimeActionsJs.indexOf('const getDockerDialogRefreshCallbackName =')
    );
    assert.match(dockerJs, /refreshDockerRuntimeState:\s*\(options = \{\}\) => refreshDockerRuntimeStateInPlace\(options\)/);
    assert.match(dockerJs, /const refreshDockerRuntimeStateInPlace = \(options = \{\}\) => \{/);
    assert.match(dockerJs, /dockerRuntimeRefreshQueue\.then\(refresh, refresh\)/);
    assert.match(dockerJs, /const preserveGroupedDom = options\?\.preserveGroupedDom === true;/);
    assert.match(dockerJs, /if \(preserveGroupedDom\) \{[\s\S]*mode: 'incremental-retry'/);
    assert.match(dockerJs, /const configurationChanged = snapshot && !dockerRuntimeSnapshotConfigMatches\(snapshot\);/);
    assert.match(dockerJs, /if \(configurationChanged && !preserveGroupedDom\) \{\s*fallbackReason = 'configuration-changed';\s*return false;\s*\}/);
    assert.match(dockerJs, /if \(configurationChanged\) \{[\s\S]*deferredConfigurationRebuild:/);
    assert.match(dockerJs, /queueLoadlistRefresh\(\{ suppressLoadingUi: true, reloadSource: 'plugin-action-followup' \}\);/);
    assert.match(dockerJs, /await refreshDockerRuntimeStateInPlace\(\{ followupDelayMs: 650 \}\);/);
    assert.match(dockerRuntimeActionsJs, /const refreshDockerRuntimeState = typeof deps\.refreshDockerRuntimeState === 'function'/);
    assert.match(dockerRuntimeActionsJs, /const armDockerPostUpdateRuntimeReconcileWindow = typeof deps\.armDockerPostUpdateRuntimeReconcileWindow === 'function'/);
    assert.match(dockerRuntimeActionsJs, /const suspendDockerHostUpdateSync = typeof deps\.suspendDockerHostUpdateSync === 'function'/);
    assert.match(dockerRuntimeActionsJs, /refreshDockerRuntimeState\(\{\s*followupDelayMs: DOCKER_DIALOG_RUNTIME_REFRESH_FOLLOWUP_DELAY_MS,\s*liveUpdateStatus: true,\s*preserveGroupedDom: true\s*\}\)/);
    assert.match(dockerRuntimeActionsJs, /const DOCKER_DIALOG_REFRESH_CALLBACK_NAME = '__fvplusDockerDialogRefresh';/);
    assert.match(dockerRuntimeActionsJs, /const DOCKER_DIALOG_BACKSTOP_REFRESH_DELAYS_MS = \[3200,\s*9000\];/);
    assert.match(dockerRuntimeActionsJs, /const DOCKER_DIALOG_POST_RENDER_RECONCILE_WINDOW_MS = 120000;/);
    assert.match(dockerRuntimeActionsJs, /const runDockerDialogRefresh = \(\) => \{[\s\S]*refreshDockerRuntimeState\(\{\s*followupDelayMs: DOCKER_DIALOG_RUNTIME_REFRESH_FOLLOWUP_DELAY_MS,\s*liveUpdateStatus: true,\s*preserveGroupedDom: true\s*\}\)/);
    assert.doesNotMatch(dialogRefreshSource, /refreshDockerList\(\)/);
    assert.match(dockerRuntimeActionsJs, /const scheduleDockerDialogRefreshBackstops = \(\) => \{[\s\S]*refreshDockerRuntimeState\(\{\s*followupDelayMs: DOCKER_DIALOG_RUNTIME_REFRESH_FOLLOWUP_DELAY_MS,\s*liveUpdateStatus: true,\s*preserveGroupedDom: true\s*\}\)/);
    assert.doesNotMatch(dialogBackstopSource, /queueDockerListRefresh|refreshDockerList/);
    assert.match(dockerRuntimeActionsJs, /const getDockerDialogRefreshCallbackName = \(\) => \{[\s\S]*win\[DOCKER_DIALOG_REFRESH_CALLBACK_NAME\] = \(\) => \{[\s\S]*runDockerDialogRefresh\(\);[\s\S]*\};[\s\S]*return DOCKER_DIALOG_REFRESH_CALLBACK_NAME;/);
    assert.match(dockerRuntimeActionsJs, /const openDockerFolderUpdateDialog = \(containersToUpdate,\s*title\) => \{[\s\S]*if \(armDockerPostUpdateRuntimeReconcileWindow\) \{[\s\S]*armDockerPostUpdateRuntimeReconcileWindow\(DOCKER_DIALOG_POST_RENDER_RECONCILE_WINDOW_MS,\s*\{[\s\S]*initialDelayMs: DOCKER_DIALOG_RUNTIME_REFRESH_DELAY_MS,[\s\S]*pollDelayMs: Math\.max\(\.\.\.DOCKER_DIALOG_BACKSTOP_REFRESH_DELAYS_MS\)[\s\S]*\}\);[\s\S]*\} else \{[\s\S]*suspendDockerHostUpdateSync\(DOCKER_DIALOG_POST_RENDER_RECONCILE_WINDOW_MS\);[\s\S]*\}[\s\S]*scheduleDockerDialogRefreshBackstops\(\);[\s\S]*openDockerDialog\('update_container ' \+ containersToUpdate,\s*title,\s*'',\s*getDockerDialogRefreshCallbackName\(\)\);/);
    assert.match(dockerJs, /queueLoadlistRefresh:\s*\(options = \{\}\) => queueLoadlistRefresh\(options\),/);
    assert.match(dockerJs, /openDocker:\s*\(\.\.\.args\) => \{[\s\S]*if \(typeof window\?\.openDocker === 'function'\) \{[\s\S]*return window\.openDocker\(\.\.\.args\);[\s\S]*\}[\s\S]*return typeof openDocker === 'function' \? openDocker\(\.\.\.args\) : undefined;[\s\S]*\},/);
    assert.match(dockerJs, /folderEvents,\s*refreshDockerRuntimeState:\s*\(options = \{\}\) => refreshDockerRuntimeStateInPlace\(options\),\s*queueLoadlistRefresh:\s*\(options = \{\}\) => queueLoadlistRefresh\(options\),\s*armDockerPostUpdateRuntimeReconcileWindow:\s*\(durationMs = 0,\s*options = \{\}\) =>\s*armDockerPostUpdateRuntimeReconcileWindow\(durationMs,\s*options\),\s*suspendDockerHostUpdateSync:\s*\(durationMs = 0\) => suspendDockerHostUpdateSync\(durationMs\),/);
    assert.match(dockerJs, /const forceUpdateFolder = \(id,\s*\{ includeDescendants = true \} = \{\}\) => \{[\s\S]*appendDockerBulkUpdateTrace\('forceUpdateFolderDispatch'/);
    assert.match(dockerJs, /const forceUpdateFolder = \(id,\s*\{ includeDescendants = true \} = \{\}\) => \{[\s\S]*armDockerPostUpdateRuntimeReconcileWindow\(120000,\s*\{[\s\S]*pollDelayMs: DOCKER_POST_UPDATE_RECONCILE_POLL_INTERVAL_MS[\s\S]*\}\);[\s\S]*actionsApi\.forceUpdateFolder\(id,\s*\{ includeDescendants \}\);/);
    assert.match(dockerJs, /const updateFolder = \(id,\s*\{ includeDescendants = true \} = \{\}\) => \{[\s\S]*appendDockerBulkUpdateTrace\('updateFolderDispatch'/);
    assert.match(dockerJs, /const updateFolder = \(id,\s*\{ includeDescendants = true \} = \{\}\) => \{[\s\S]*armDockerPostUpdateRuntimeReconcileWindow\(120000,\s*\{[\s\S]*pollDelayMs: DOCKER_POST_UPDATE_RECONCILE_POLL_INTERVAL_MS[\s\S]*\}\);[\s\S]*actionsApi\.updateFolder\(id,\s*\{ includeDescendants \}\);/);
    assert.doesNotMatch(
        dockerRuntimeActionsJs,
        /const actionFolder = async \(id,\s*action,\s*\{ includeDescendants = true \} = \{\}\) => \{[\s\S]*?const errors = results\.filter\(\(entry\) => entry\?\.success !== true\);[\s\S]*?refreshDockerList\(\);[\s\S]*?\};/
    );
});

test('vm runtime actions patch rows while structural folder changes retain the debounced reload queue', () => {
    assert.match(vmJs, /const settleVmFolderActions = async \(requests,\s*source\) => \{[\s\S]*?await refreshVmRuntimeStateInPlace\(\);[\s\S]*?window\.setTimeout\(\(\) => \{ void refreshVmRuntimeStateInPlace\(\); \}, 650\);[\s\S]*?\};/);
    assert.match(vmJs, /const folderCustomAction = async \(id,\s*action\) => \{[\s\S]*?await nativeActions\.runUserScript\(act, \{ openBox \}\);[\s\S]*?queueLoadlistRefresh\(\);[\s\S]*?\};/);
    assert.match(vmJs, /const cloneVmFolderFromMenu = async \(id\) => \{[\s\S]*?queueLoadlistRefresh\(\);[\s\S]*?\};/);
    assert.match(vmJs, /const pasteVmFolderSettingsFromMenu = async \(id\) => \{[\s\S]*?queueLoadlistRefresh\(\);[\s\S]*?\};/);
    assert.ok(vmJs.includes("await pluginRequestClient.postJson('/plugins/folderview.plus/server/sync_order.php', { type: 'vm' });"));
    assert.ok(vmJs.includes('swal.close();'));
});

test('shared User Scripts invocation preserves arguments and the foreground, background, and direct PHP host contracts', async () => {
    const command = 'fixture/file & id';
    const args = ' A&B#C +%? ä中 ';
    const csrf = 'fixture&csrf';
    const calls = [];
    const dialogs = [];
    const promise = value => ({ promise: async () => value });
    let variables = '';
    const window = { csrf_token: csrf, $: {
        post: (url, data) => {
            calls.push([url, data]);
            if (data.action === 'getScriptVariables') return promise(variables);
            if (data.action === 'directRunScript') return promise('/plugins/user.scripts/fixture.php');
            return promise(command);
        },
        get: url => { calls.push([url]); return promise(''); }
    } };
    vm.runInNewContext(runtimeNativeActions, { window });
    const { runUserScript } = window.FolderViewPlusFoundationModules.runtimeNativeActions;
    const openBox = (...values) => dialogs.push(values);
    const action = { script: 'Fixture script', script_args: args, name: 'Fixture action' };

    await runUserScript({ ...action, script_sync: false }, { openBox });
    const background = new URL(calls.at(-1)[0], 'http://localhost').searchParams;
    assert.equal(background.get('arg1'), command);
    assert.equal(background.get('arg2'), args);
    assert.equal(background.get('csrf_token'), csrf);
    assert.equal(calls[0][1].path, '/boot/config/plugins/user.scripts/scripts/Fixture script/script');

    await runUserScript({ ...action, script_sync: true }, { openBox });
    const foreground = dialogs.at(-1);
    const fields = new URLSearchParams(foreground[0].split('&').slice(1).join('&'));
    assert.equal(fields.get('arg1'), command);
    assert.equal(fields.get('arg2'), args);
    assert.deepEqual(foreground.slice(1), [action.name, 800, 1200, true, 'loadlist']);

    variables = 'directPHP=enabled\n';
    await runUserScript({ ...action, script_sync: true }, { openBox });
    assert.deepEqual(dialogs.at(-1), ['/plugins/user.scripts/fixture.php', action.name, 800, 1200, 'loadlist']);

    window.$.post = () => ({ promise: async () => { throw new Error('fixture private launch token'); } });
    await assert.rejects(runUserScript(action, { openBox }), error => {
        assert.match(error.message, /Check that the plugin and script are available/);
        assert.doesNotMatch(error.message, /fixture private/);
        return true;
    });
});

test('VM named Resume and Restart dispatch the correct host actions and reconcile only accepted requests', async () => {
    const posted = [], reconciled = [], dialogs = [];
    const store = [];
    const $ = () => ({ show() {}, hide() {}, removeClass() { return this; }, addClass() { return this; } });
    $.i18n = () => 'Execution error';
    $.ajax = async ({ data }) => {
        posted.push([data.action, data.uuid]);
        if (data.uuid === 'paused') return { error: 'Refused <offline>' };
        return { success: true, error: 'Guest agent warning' };
    };
    const window = { $, setTimeout() {}, swal: options => dialogs.push(options) };
    vm.runInNewContext(runtimeNativeActions, { window });
    const targets = {
        Paused: { state: 'paused', id: 'paused' },
        Sleeping: { state: 'pmsuspended', id: 'sleeping' },
        Running: { state: 'running', id: 'running' },
        Stopped: { state: 'shutoff', id: 'stopped' }
    };
    const action = { type: 0, conatiners: Object.keys(targets) };
    const source = vmJs.slice(vmJs.indexOf('const resolveVmFolderAction ='), vmJs.indexOf('const cloneVmFolderFromMenu ='));
    const context = {
        $, window,
        openBox() {},
        document: { body: { classList: { contains: () => false } } },
        globalFolders: { fixture: { containers: targets, actions: [
            { ...action, action: 1, modes: 3 }, { ...action, action: 2 }
        ] } },
        vmSafeUiActionRunner: { run: (_key, fn) => fn() },
        runVmGuardedAction: (_key, fn) => fn(),
        ensureVmFolderUnlocked: () => true,
        getScopedVmRuntimeContainersForFolder: () => targets,
        updateVmFolderRuntimeSummary() {},
        vmRuntimeStateStore: { set: state => store.push(state.inFlightAction) },
        vmLifecycleApi: { run: async (requests, { source }) => reconciled.push([source, Array.from(requests, request => request.uuid)]) },
        refreshVmRuntimeStateInPlace: async () => {},
        escapeHtml: value => String(value).replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    };
    const run = vm.runInNewContext(source + '\n({ actionFolder, folderCustomAction })', context);
    await run.folderCustomAction('fixture', 0);
    assert.deepEqual(posted.splice(0), [['domain-resume', 'paused'], ['domain-pmwakeup', 'sleeping']]);
    assert.deepEqual(reconciled.at(-1), ['custom-folder-action', ['sleeping']]);
    assert.equal(dialogs.at(-1).text, '1 accepted · 1 failed<br>Paused · Refused &lt;offline&gt;');

    await run.folderCustomAction('fixture', 1);
    assert.deepEqual(posted.splice(0), [['domain-restart', 'running']]);
    assert.deepEqual(reconciled.at(-1), ['custom-folder-action', ['running']]);
    assert.equal(dialogs.length, 1);

    await run.actionFolder('fixture', 'domain-resume');
    assert.deepEqual(posted, [['domain-resume', 'paused'], ['domain-pmwakeup', 'sleeping']]);
    assert.deepEqual(reconciled.at(-1), ['folder-action', ['sleeping']]);
    assert.equal(dialogs.length, 2);
    assert.equal(store.at(-1), '');
});

test('Docker named actions preserve independent outcomes and refresh after a partial host refusal', async () => {
    const posted = [], dialogs = [], spinner = [];
    let refreshes = 0;
    const $ = () => ({ show: () => spinner.push('show'), hide: () => spinner.push('hide') });
    $.i18n = () => 'Execution error';
    $.ajax = async ({ data }) => {
        posted.push([data.action, data.container]);
        if (data.container === 'refused') throw { responseJSON: { success: 'Daemon refused <detail>' } };
        return { success: true };
    };
    const window = { $, swal: options => dialogs.push(options) };
    vm.runInNewContext(runtimeNativeActions, { window });
    const targets = {
        Started: { state: true, id: 'refused' },
        Stopped: { state: false, id: 'accepted' }
    };
    const source = dockerJs.slice(dockerJs.indexOf('const folderCustomAction ='), dockerJs.indexOf('const DOCKER_CONTEXT_QUICK_ACTION_LABELS ='));
    const context = {
        $, window,
        openBox() {},
        document: { body: { classList: { contains: () => false } } },
        globalFolders: { fixture: { actions: [{ type: 0, action: 0, modes: 0, containers: Object.keys(targets) }] } },
        getFolderRuntimeContainers: () => targets,
        runDockerGuardedAction: (_key, fn) => fn(),
        eventURL: '/fixture',
        refreshDockerRuntimeStateInPlace: async () => { refreshes++; },
        escapeHtml: value => String(value).replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    };
    const run = vm.runInNewContext(source + '\nfolderCustomAction', context);
    await run('fixture', 0);
    assert.deepEqual(posted, [['stop', 'refused'], ['start', 'accepted']]);
    assert.equal(dialogs[0].text, '1 accepted · 1 failed<br>Started · Daemon refused &lt;detail&gt;');
    assert.equal(refreshes, 1);
    assert.deepEqual(spinner, ['show', 'hide']);
});
