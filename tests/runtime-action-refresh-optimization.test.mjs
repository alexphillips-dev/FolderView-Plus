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
const runtimeSharedPrimitives = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/runtime.shared-primitives.js');

const dockerActionSource = dockerJs.slice(dockerJs.indexOf('let dockerCustomActionsInFlight ='), dockerJs.indexOf('const DOCKER_CONTEXT_QUICK_ACTION_LABELS ='));
const vmActionSource = vmJs.slice(vmJs.indexOf('const resolveVmFolderAction ='), vmJs.indexOf('const cloneVmFolderFromMenu ='));

const createActionWindow = (properties) => {
    const window = { ...properties };
    vm.runInNewContext(runtimeNativeActions + '\n' + runtimeSharedPrimitives, { window });
    return window;
};

const createActionRunner = (window) => window.FolderViewPlusFoundationModules.runtimeSharedPrimitives.createSafeUiActionRunner();

const bindPagehide = (source, context) => {
    const events = new EventTarget();
    context.window.addEventListener = events.addEventListener.bind(events);
    const start = source.lastIndexOf("window.addEventListener('pagehide',");
    const suffix = '}, { once: true });';
    const end = source.indexOf(suffix, start);
    assert.ok(start >= 0 && end > start);
    vm.runInContext(source.slice(start, end + suffix.length), context);
    return () => events.dispatchEvent(new Event('pagehide'));
};

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
    const window = createActionWindow({ $, setTimeout() {}, clearTimeout() {}, swal: options => dialogs.push(options) });
    const targets = {
        Paused: { state: 'paused', id: 'paused' },
        Sleeping: { state: 'pmsuspended', id: 'sleeping' },
        Running: { state: 'running', id: 'running' },
        Stopped: { state: 'shutoff', id: 'stopped' }
    };
    const action = { type: 0, conatiners: Object.keys(targets) };
    const context = {
        $, window,
        vmRuntimePageDisposed: false,
        openBox() {},
        document: { body: { classList: { contains: () => false } } },
        globalFolders: { fixture: { containers: targets, actions: [
            { ...action, action: 1, modes: 3 }, { ...action, action: 2 }
        ] } },
        vmSafeUiActionRunner: createActionRunner(window),
        runVmGuardedAction: (_key, fn) => fn(),
        ensureVmFolderUnlocked: () => true,
        getScopedVmRuntimeContainersForFolder: () => targets,
        updateVmFolderRuntimeSummary() {},
        vmRuntimeStateStore: { set: state => store.push(state.inFlightAction) },
        vmLifecycleApi: { run: async (requests, { source }) => reconciled.push([source, Array.from(requests, request => request.uuid)]) },
        refreshVmRuntimeStateInPlace: async () => {},
        escapeHtml: value => String(value).replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    };
    const run = vm.runInNewContext(vmActionSource + '\n({ actionFolder, folderCustomAction })', context);
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
    const window = createActionWindow({ $, swal: options => dialogs.push(options) });
    const targets = {
        Started: { state: true, id: 'refused' },
        Stopped: { state: false, id: 'accepted' }
    };
    const context = {
        $, window,
        dockerRuntimePageDisposed: false,
        dockerSafeUiActionRunner: createActionRunner(window),
        openBox() {},
        document: { body: { classList: { contains: () => false } } },
        globalFolders: { fixture: { actions: [{ type: 0, action: 0, modes: 0, containers: Object.keys(targets) }] } },
        getFolderRuntimeContainers: () => targets,
        runDockerGuardedAction: (_key, fn) => fn(),
        eventURL: '/fixture',
        refreshDockerRuntimeStateInPlace: async () => { refreshes++; },
        escapeHtml: value => String(value).replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    };
    const run = vm.runInNewContext(dockerActionSource + '\nfolderCustomAction', context);
    await run('fixture', 0);
    assert.deepEqual(posted, [['stop', 'refused'], ['start', 'accepted']]);
    assert.equal(dialogs[0].text, '1 accepted · 1 failed<br>Started · Daemon refused &lt;detail&gt;');
    assert.equal(refreshes, 1);
    assert.deepEqual(spinner, ['show', 'hide']);
});

test('Docker named actions suppress duplicate clicks, allow independent actions and retries, and stop UI work on pagehide', async () => {
    const pending = [], refreshes = [], dialogs = [], spinner = [];
    let groupCleared = false;
    const $ = () => ({ show: () => spinner.push('show'), hide: () => spinner.push('hide') });
    $.i18n = () => 'Execution error';
    $.ajax = ({ data }) => {
        const { promise, resolve } = Promise.withResolvers();
        pending.push({ action: data.action, container: data.container, resolve });
        return promise;
    };
    const window = createActionWindow({ $, swal: options => dialogs.push(options) });
    const noop = () => {};
    const toggle = { type: 0, action: 0, modes: 0, containers: ['Member'] };
    const context = vm.createContext({
        $, window,
        document: { body: { classList: { contains: () => false } } },
        globalFolders: {
            first: { containers: { Member: { id: 'first-member', state: true } }, actions: [toggle, { ...toggle, action: 2 }] },
            second: { containers: { Member: { id: 'second-member', state: false } }, actions: [toggle] }
        },
        getFolderRuntimeContainers: folder => folder.containers,
        dockerRuntimePageDisposed: false,
        clearDockerUnassignedGroup: () => { groupCleared = true; },
        dockerRuntimeRefreshGeneration: 0,
        dockerBootstrapGeneration: 0,
        dockerSafeUiActionRunner: createActionRunner(window),
        runDockerGuardedAction: (_key, fn) => fn(),
        eventURL: '/fixture',
        refreshDockerRuntimeStateInPlace: async ({ followupDelayMs }) => refreshes.push(followupDelayMs),
        escapeHtml: String,
        getDockerRuntimeReconcileApi: () => null,
        dockerPageTitle: { dispose: noop },
        dockerRuntimeLayoutStabilityTracker: null,
        dockerQuickFinderApi: null,
        dockerLiveRefreshController: { dispose: noop },
        dockerApiIntegration: null,
        clearTimeout: noop,
        queuedLoadlistTimer: null,
        dockerPinnedFolderServerReconcileTimer: null,
        dockerRuntimePrivacyServerReconcileTimer: null,
        folderViewPlusDockerStartOrderSyncTimer: null,
        dockerFolderRowActionsController: { destroy: noop },
        dockerRuntimeColumnControllerApi: { dispose: noop },
        dockerDeferredPreviewController: { destroy: noop },
        dockerProviderHealthController: null,
        runtimeHostAdapters: null
    });
    const run = vm.runInContext(dockerActionSource + '\nfolderCustomAction', context);
    const pagehide = bindPagehide(dockerJs, context);

    const first = run('first', 0);
    const duplicate = await run('first', 0);
    assert.equal(duplicate.reason, 'in-flight');
    assert.equal(pending.length, 1);

    const otherFolder = run('second', 0);
    const otherAction = run('first', 1);
    assert.deepEqual(pending.map(({ action, container }) => [action, container]), [
        ['stop', 'first-member'], ['start', 'second-member'], ['restart', 'first-member']
    ]);
    pending[1].resolve({ success: true });
    pending[2].resolve({ success: true });
    assert.equal((await otherFolder).ok, true);
    assert.equal((await otherAction).ok, true);
    assert.deepEqual(spinner, ['show']);
    pending[0].resolve({ success: true });
    assert.equal((await first).ok, true);
    assert.deepEqual(refreshes, [650, 650, 650]);
    assert.deepEqual(spinner, ['show', 'hide']);

    const retry = run('first', 0);
    assert.equal(pending.length, 4);
    assert.equal(pending[3].container, 'first-member');
    pending[3].resolve({ success: true });
    assert.equal((await retry).ok, true);

    const lateAction = run('first', 0);
    pagehide();
    assert.equal(groupCleared, true);
    pending[4].resolve({ error: 'Fixture host refusal' });
    assert.equal((await lateAction).ok, true);
    await run('second', 0);
    assert.equal(pending.length, 5);
    assert.equal(dialogs.length, 0);
    assert.deepEqual(refreshes, [650, 650, 650, 650]);
    assert.deepEqual(spinner, ['show', 'hide', 'show', 'hide', 'show']);
});

const createVmActionFixture = () => {
    const pending = [], timers = new Map(), summaries = [], dialogs = [], refreshes = [];
    let groupCleared = false;
    let timerId = 0;
    const $ = () => ({ show() {}, hide() {}, removeClass() { return this; }, addClass() { return this; } });
    $.i18n = () => 'Execution error';
    $.ajax = ({ data }) => {
        const { promise, resolve } = Promise.withResolvers();
        pending.push({ action: data.action, uuid: data.uuid, resolve });
        return promise;
    };
    const window = createActionWindow({
        $,
        swal: options => dialogs.push(options),
        setTimeout: (callback, delay) => {
            timers.set(++timerId, { callback, delay });
            return timerId;
        },
        clearTimeout: id => timers.delete(id)
    });
    const noop = () => {};
    const folders = { fixture: { containers: { Member: { state: 'paused', id: 'paused' } } } };
    const context = vm.createContext({
        $, window,
        document: { body: { classList: { contains: () => false } } },
        globalFolders: folders,
        vmRuntimePageDisposed: false,
        vmUnassignedGroup: { clear: () => { groupCleared = true; } },
        vmSafeUiActionRunner: createActionRunner(window),
        runVmGuardedAction: (_key, fn) => fn(),
        ensureVmFolderUnlocked: () => true,
        getScopedVmRuntimeContainersForFolder: id => folders[id].containers,
        updateVmFolderRuntimeSummary: (id, folder) => summaries.push([id, folder]),
        vmRuntimeStateStore: { set: noop },
        vmLifecycleApi: { run: async () => {} },
        refreshVmRuntimeStateInPlace: async () => refreshes.push('refresh'),
        escapeHtml: String,
        vmQuickFinderApi: null,
        vmLiveRefreshController: { dispose: noop },
        clearTimeout: window.clearTimeout,
        queuedLoadlistTimer: null,
        vmRuntimeWidthReflowTimer: null,
        vmZebraRefreshTimer: null,
        vmFolderRowActionsController: { destroy: noop },
        vmNativeDetailRowObserver: null,
        vmNativeToggleClickHost: null,
        HTMLTableElement: class HTMLTableElement {},
        vmDeferredPreviewController: { destroy: noop },
        runtimeHostAdapters: null
    });
    const run = vm.runInContext(vmActionSource + '\nactionFolder', context);
    const pagehide = bindPagehide(vmJs, context);
    return { run, pagehide, folders, timers, pending, summaries, refreshes, dialogs, isGroupCleared: () => groupCleared };
};

test('VM folder action completion updates the rerendered folder and skips one removed in flight', async () => {
    const { run, folders, pending, summaries } = createVmActionFixture();
    const oldFolder = folders.fixture;
    const action = run('fixture', 'domain-resume');
    assert.equal(pending[0].action, 'domain-resume');
    assert.equal(pending[0].uuid, 'paused');
    const replacement = { containers: { ...oldFolder.containers } };
    folders.fixture = replacement;
    pending[0].resolve({ success: true });
    assert.equal((await action).ok, true);
    assert.equal(summaries.length, 1);
    assert.equal(summaries[0][0], 'fixture');
    assert.strictEqual(summaries[0][1], replacement);

    const removedAction = run('fixture', 'domain-resume');
    delete folders.fixture;
    pending[1].resolve({ success: true });
    assert.equal((await removedAction).ok, true);
    assert.equal(summaries.length, 1);
});

test('VM pagehide cancels the scheduled fallback and drops a late native response', async () => {
    const { run, pagehide, timers, pending, summaries, refreshes, dialogs, isGroupCleared } = createVmActionFixture();
    const action = run('fixture', 'domain-resume');
    pending[0].resolve({ error: 'Fixture host refusal' });
    assert.equal((await action).ok, true);
    assert.equal(refreshes.length, 1);
    assert.equal(timers.size, 1);
    const [{ callback, delay }] = timers.values();
    assert.equal(delay, 650);
    assert.equal(dialogs.length, 1);
    assert.equal(summaries.length, 1);

    const lateAction = run('fixture', 'domain-resume');
    pagehide();
    assert.equal(isGroupCleared(), true);
    assert.equal(timers.size, 0);
    // Simulate a callback already taken from the timer queue when pagehide ran.
    callback();
    pending[1].resolve({ error: 'Fixture late host refusal' });
    assert.equal((await lateAction).ok, true);
    assert.equal(refreshes.length, 1);
    assert.equal(timers.size, 0);
    assert.equal(dialogs.length, 1);
    assert.equal(summaries.length, 1);
});
