import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
const require = createRequire(import.meta.url);

const libPhp = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.docker-order.php');
const prefsPhp = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.prefs.php');
const validationPhp = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.validation.php');
const prefsEndpoint = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/prefs.php');
const startOrderEndpoint = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/docker_start_order.php');
const settingsPage = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/FolderViewPlus.page');
const settingsJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js');
const startOrderCss = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/start-order-workspace.css');
const utilsNormalizationJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.utils-normalization.js');
const utilsPrefsJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.utils-prefs.js');
const dockerJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js');
const startOrderModelJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.start-order-model.js');
const startOrderViewJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.start-order-view.js');
const startOrderWorkspaceJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.start-order-workspace.js');
const startOrderSequencePhp = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.docker-start-order-sequence.php');

test('Docker start-order preferences are normalized and accepted', () => {
    assert.match(prefsPhp, /'dockerStartOrder'\s*=>\s*\[/);
    assert.match(prefsPhp, /function normalizeDockerStartOrderPrefs\(\$value\): array/);
    assert.match(prefsPhp, /'mode'\s*=>\s*\$mode/);
    assert.match(prefsPhp, /'remaining'\s*=>\s*\$remaining/);
    assert.match(prefsPhp, /'batches'\s*=>\s*\$batches/);
    assert.match(validationPhp, /'dockerStartOrder'/);
    assert.match(validationPhp, /dockerStartOrder\.batches/);
    assert.match(utilsNormalizationJs, /DEFAULT_DOCKER_START_ORDER/);
    assert.match(utilsPrefsJs, /dockerStartOrder/);
    assert.match(prefsPhp, /'unmanaged'/);
    assert.match(prefsPhp, /'containerWaits'\s*=>\s*\$containerWaits/);
    assert.match(startOrderModelJs, /const MODES = Object\.freeze\(\['unmanaged', 'docker-page', 'custom-batches'\]\)/);
    assert.match(startOrderModelJs, /modules\.startOrderModel = factory\(modules\.utilityFoundation\)/);
});

test('server builds preview and sync order from Docker page or custom batches', () => {
    assert.match(libPhp, /function buildDockerStartOrderContext\(\?array \$verifiedInventory = null\): array/);
    assert.match(libPhp, /function buildDockerPageStartOrder\(array \$context, bool \$followSavedLayout = true\): array/);
    assert.match(libPhp, /function buildDockerCustomStartOrder\(array \$context, array \$plan\): array/);
    assert.match(libPhp, /function buildDockerStartOrderPlan\(array \$context = null\): array/);
    assert.match(libPhp, /function dockerStartOrderPreview\(\): array/);
    assert.match(libPhp, /custom-batches/);
    assert.match(libPhp, /fvplus_set_autostart_line_delay/);
    assert.match(libPhp, /autostartOrder/);
    assert.match(libPhp, /buildDockerStartOrderSequence/);
    assert.match(startOrderSequencePhp, /function buildDockerStartOrderSequence/);
    assert.match(startOrderSequencePhp, /array_key_exists\(\$name, \$waits\)/);
    assert.match(startOrderSequencePhp, /function applyDockerStartOrderSequenceWaits/);
    assert.match(libPhp, /skipped because Docker start order is unmanaged/);
    assert.match(libPhp, /'managed'\s*=>\s*\$mode !== 'unmanaged'/);
    assert.match(prefsEndpoint, /normalizeDockerStartOrderPrefs\(\$current\['dockerStartOrder'\]/);
    assert.match(startOrderEndpoint, /dockerStartOrderPreview\(\)/);
    assert.match(startOrderEndpoint, /fvplusRespondToDockerOrderSync\('docker'\)/);
});

test('Settings acknowledges only a verified sync and keeps queued or unmanaged previews intact', async () => {
    const start = settingsJs.indexOf('const syncDockerStartOrderNow =');
    const end = settingsJs.indexOf('const normalizeSettingsTableRenderType', start);
    const code = settingsJs.slice(start, end) + '\nsyncDockerStartOrderNow();';
    for (const [outcome, expected] of [
        ['synced', 'Docker start order synced.'],
        ['queued', 'FolderView Plus configuration is busy. Please retry the action.'],
        ['unmanaged', 'Unraid owns the start order.'],
        ['failed', 'Docker start order sync failed']
    ]) {
        const statuses = [], previews = [], errors = [];
        const preview = { order: ['fixture-container'] };
        await vm.runInNewContext(code, {
            flushDockerStartOrderSaveQueue: async () => {},
            apiPostJson: async () => {
                if (outcome === 'failed') throw new Error('Inventory unavailable');
                return { syncOutcome: outcome, preview };
            },
            setUpdateStatus: status => statuses.push(status),
            showError: (...args) => errors.push(args),
            renderDockerStartOrderPreview: value => previews.push(value),
            renderDockerStartOrderSyncOutcome: () => {},
            dockerStartOrderSyncOutcome: '',
            dockerStartOrderPreviewGeneration: 0,
            dockerStartOrderEditGeneration: 0,
            surfaceT: (_key, fallback) => fallback
        });
        assert.deepEqual(statuses, outcome === 'failed' ? [''] : ['', expected]);
        assert.deepEqual(previews, outcome === 'synced' ? [preview] : []);
        assert.equal(errors[0]?.[0], outcome === 'failed' ? expected : undefined);
    }
});

test('Settings clears the old preview on mode changes and ignores an earlier response', async () => {
    const startMode = settingsJs.indexOf('const updateDockerStartOrderMode =');
    const endMode = settingsJs.indexOf('const updateDockerStartOrderRemaining =', startMode);
    const startPreview = settingsJs.indexOf('const refreshDockerStartOrderPreview =');
    const endPreview = settingsJs.indexOf('const syncDockerStartOrderNow =', startPreview);
    const requests = [], renders = [], saves = [];
    const { change, refresh } = vm.runInNewContext(`
        let dockerStartOrderPreviewTimer = null;
        let dockerStartOrderPreviewGeneration = 0;
        let dockerStartOrderDraftPlan = null;
        ${settingsJs.slice(startMode, endMode)}
        ${settingsJs.slice(startPreview, endPreview)}
        ({ change: updateDockerStartOrderMode, refresh: refreshDockerStartOrderPreview });
    `, {
        dockerStartOrderModel: { MODES: ['unmanaged', 'docker-page'] },
        normalizeDockerStartOrderPrefsForUi: () => ({ mode: 'unmanaged' }),
        saveDockerStartOrderPlan: async (...args) => saves.push(args),
        flushDockerStartOrderSaveQueue: async () => {},
        $: () => ({ length: 0 }),
        apiGetJson: () => new Promise(resolve => requests.push(resolve)),
        renderDockerStartOrderPreview: preview => renders.push(preview),
        showError: (_label, error) => { throw error; }
    });
    const previous = refresh({ flush: false });
    await change('unmanaged');
    assert.deepEqual(JSON.parse(JSON.stringify(saves)), [
        [{ mode: 'unmanaged' }, { preservePreview: false, refreshPreview: true }]
    ]);
    const latest = refresh({ flush: false });
    requests[1]({ preview: { mode: 'unmanaged' } });
    await latest;
    requests[0]({ preview: { mode: 'docker-page' } });
    await previous;
    assert.deepEqual(renders, [{ mode: 'unmanaged' }]);
});

test('a failed mode save restores committed Settings state and permits preview', async () => {
    const normalizeStart = settingsJs.indexOf('const normalizeDockerStartOrderPrefsForUi =');
    const normalizeEnd = settingsJs.indexOf('const getDockerStartOrderContainerNames =', normalizeStart);
    const queueStart = settingsJs.indexOf('let dockerStartOrderPreviewTimer =');
    const queueEnd = settingsJs.indexOf('const updateDockerStartOrderRemaining =', queueStart);
    const previewStart = settingsJs.indexOf('const renderDockerStartOrderPreview =');
    const previewEnd = settingsJs.indexOf('const syncDockerStartOrderNow =', previewStart);
    const plan = { mode: 'docker-page', batches: [] };
    const prefsByType = { docker: { dockerStartOrder: plan } };
    const messages = [], errors = [], renders = [], saves = [];
    let rejectWrite;
    const workspace = vm.runInNewContext(`
        ${settingsJs.slice(normalizeStart, normalizeEnd)}
        ${settingsJs.slice(queueStart, queueEnd)}
        ${settingsJs.slice(previewStart, previewEnd)}
        ({ change: updateDockerStartOrderMode, refresh: refreshDockerStartOrderPreview, mode: () => normalizeDockerStartOrderPrefsForUi().mode });
    `, {
        prefsByType,
        utils: { normalizePrefs: value => value },
        diagnosticsPrefsCoordinator: { getConfirmedPrefs: () => ({ dockerStartOrder: plan }) },
        dockerStartOrderModel: { MODES: ['unmanaged', 'docker-page', 'custom-batches'], normalizePlan: value => value },
        prefsStoreModule: { mergePatch: (_base, patch) => patch },
        window: { clearTimeout() {}, setTimeout: () => 1 },
        postPrefs: (_type, patch) => {
            saves.push(patch);
            return new Promise((_, reject) => { rejectWrite = reject; });
        },
        $: selector => ({ length: 1, html: value => { if (selector === '#docker-start-order-preview') messages.push(value); } }),
        renderDockerStartOrderWorkspace: options => renders.push(options),
        infoByType: { docker: {} },
        dockerStartOrderView: { buildPreviewHtml: preview => `Preview ${preview.mode}`, buildHeaderSummaryHtml: () => '' },
        apiGetJson: async () => ({ preview: plan }),
        surfaceT: (_key, fallback) => fallback,
        showError: (_label, error) => errors.push(error.message)
    });
    await workspace.change('unmanaged');
    assert.equal(workspace.mode(), 'unmanaged');
    const refresh = workspace.refresh();
    await Promise.resolve();
    rejectWrite(new Error('synthetic rejected save'));
    await refresh;
    assert.equal(workspace.mode(), 'docker-page');
    assert.equal(prefsByType.docker.dockerStartOrder.mode, 'docker-page');
    assert.equal(messages.at(-1), 'Preview docker-page');
    assert.deepEqual(errors, ['synthetic rejected save']);
    assert.equal(renders.length, 2);
    assert.deepEqual(JSON.parse(JSON.stringify(saves)), [{ dockerStartOrder: { mode: 'unmanaged' } }]);
});

test('the autostart workspace issues a mutation for just the selected container', async () => {
    const module = { exports: {} };
    vm.runInNewContext(startOrderWorkspaceJs, { module });
    const info = { alpha: { autostart: true }, beta: { autostart: true }, gamma: { autostart: false } };
    const writes = [];
    const refreshes = [];
    let mode = 'custom-batches';
    const workspace = module.exports.createApi({
        getPlan: () => ({ mode }), getInfo: () => info,
        writeAutostart: async (...args) => writes.push(args), refreshPreview: async () => refreshes.push(true),
        showError: error => assert.fail(error), setStatus() {}
    });
    await workspace.toggleAutostart('gamma', true);
    assert.deepEqual(writes, [['gamma', true]]);
    assert.equal(info.gamma.autostart, true);
    assert.equal(refreshes.length, 1);
    mode = 'unmanaged';
    await workspace.toggleAutostart('gamma', false);
    assert.deepEqual(writes, [['gamma', true]]);
});

test('a delayed manual sync response cannot replace a newer startup preview', async () => {
    const start = settingsJs.indexOf('const syncDockerStartOrderNow =');
    const end = settingsJs.indexOf('const normalizeSettingsTableRenderType', start);
    let finishSync;
    let markSyncRequest;
    const requested = new Promise(resolve => { markSyncRequest = resolve; });
    const renders = [];
    const context = vm.createContext({
        setUpdateStatus() {}, showError: error => assert.fail(error),
        surfaceT: (_key, fallback) => fallback,
        flushDockerStartOrderSaveQueue: async () => {},
        apiPostJson: () => new Promise(resolve => { finishSync = resolve; markSyncRequest(); }),
        renderDockerStartOrderSyncOutcome() {}, renderDockerStartOrderPreview: preview => renders.push(preview),
        dockerStartOrderPreviewGeneration: 0, dockerStartOrderEditGeneration: 1, dockerStartOrderSyncOutcome: ''
    });
    const sync = vm.runInContext(settingsJs.slice(start, end) + '\nsyncDockerStartOrderNow();', context);
    await requested;
    context.dockerStartOrderPreviewGeneration += 1;
    renders.push({ sequence: [{ wait: 20 }] });
    finishSync({ syncOutcome: 'synced', preview: { sequence: [{ wait: 4 }] } });
    await sync;
    assert.deepEqual(renders, [{ sequence: [{ wait: 20 }] }]);
});

test('background preference retry publishes the committed startup sync outcome', async () => {
    const { createPreferenceSaveCoordinator } = require(path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.prefs-store.js'));
    const seed = { dockerStartOrder: { mode: 'docker-page' }, _metadata: { prefsRevision: 1 } };
    let attempts = 0;
    let notify;
    const observed = new Promise(resolve => { notify = resolve; });
    const store = createPreferenceSaveCoordinator({
        debounceMs: 0, retryDelayMs: 20,
        window: {
            CustomEvent: class { constructor(_name, { detail }) { this.detail = detail; } },
            dispatchEvent: ({ detail }) => { if (detail.dockerOrderSync) notify(detail); }
        },
        writePrefs: async () => {
            attempts++;
            if (attempts === 1) throw Object.assign(new Error('synthetic lost response'), { status: 503 });
            return { ok: true, prefs: { dockerStartOrder: { mode: 'unmanaged' } },
                metadata: { prefsRevision: 2 }, dockerOrderSync: 'unmanaged' };
        }
    });
    store.reconcile('docker', seed);
    await assert.rejects(store.save('docker', { dockerStartOrder: { mode: 'unmanaged' } }), /lost response/);
    assert.equal(store.getConfirmedPrefs('docker').dockerStartOrder.mode, 'docker-page');
    const result = await observed;
    assert.equal(attempts, 2);
    assert.equal(result.dockerOrderSync, 'unmanaged');
    assert.equal(store.getConfirmedPrefs('docker').dockerStartOrder.mode, 'unmanaged');
});

test('settings page exposes a user-friendly Docker start-order workspace', () => {
    assert.match(settingsPage, /id="docker-start-order-stage"/);
    assert.match(settingsPage, /Docker start order/);
    assert.match(settingsJs, /const renderDockerStartOrderWorkspace = \(options = \{\}\) =>/);
    assert.match(startOrderViewJs, /data-fv-start-order-region="preview"/);
    assert.match(settingsJs, /const preservePreview = options\.preservePreview === true && host\.find\('#docker-start-order-preview'\)\.length > 0;/);
    assert.match(settingsJs, /host\.find\('\[data-fv-start-order-region="top"\]'\)\.replaceWith\(dockerStartOrderView\.buildControlsHtml\(plan\)\);/);
    assert.match(settingsJs, /host\.find\('\[data-fv-start-order-region="batches"\]'\)\.replaceWith\(dockerStartOrderView\.buildBatchesHtml\(batches, batchOptions\)\);/);
    assert.match(settingsJs, /dockerStartOrderFolderOptionsCache/);
    assert.match(settingsJs, /dockerStartOrderContainerOptionsCache/);
    assert.match(startOrderViewJs, /Leave Unraid order unmanaged/);
    assert.match(startOrderViewJs, /Follow Docker page order/);
    assert.match(startOrderViewJs, /Custom batch order/);
    assert.match(startOrderViewJs, /Remaining autostart containers/);
    assert.match(startOrderViewJs, /Preview autostart sequence/);
    assert.match(startOrderViewJs, /fv-start-order-table/);
    assert.match(startOrderViewJs, /fv-start-order-switch/);
    assert.match(startOrderViewJs, /data-fv-onclick="refreshDockerStartOrderPreview\(\)"/);
    assert.match(startOrderViewJs, /net\.unraid\.docker\.icon/);
    assert.match(settingsJs, /syncDockerStartOrderNow/);
    assert.match(settingsJs, /dockerStartOrderPreviewActivation\.hydrate\(\)/);
    assert.match(settingsJs, /runtimeHydrationStateByType\.docker !== 'pending'/);
    assert.match(startOrderWorkspaceJs, /const createPreviewActivation = \(refresh\) =>/);
    assert.match(settingsJs, /toggleDockerStartOrderAutostart/);
    assert.match(settingsJs, /updateDockerStartOrderWait/);
    assert.match(startOrderWorkspaceJs, /deps\.writeAutostart\(name, enabled === true\)/);
    assert.match(startOrderEndpoint, /setDockerStartOrderAutostart/);
});

test('Docker start-order workspace uses shared Settings dark-mode tokens', () => {
    assert.match(startOrderCss, /\.fv-docker-start-order-panel\s*\{[\s\S]*var\(--fvplus-settings-surface-panel\)/);
    assert.match(startOrderCss, /\.fv-docker-start-order-workspace\s*\{[\s\S]*background:\s*transparent;/);
    assert.match(startOrderCss, /\.fv-docker-start-order-batch,[\s\S]*\.fv-docker-start-order-disabled\s*\{[\s\S]*var\(--fvplus-settings-surface-card\)/);
    assert.match(startOrderCss, /background:\s*var\(--fvplus-settings-button-quiet-top\);/);
    assert.doesNotMatch(startOrderCss, /background:\s*#(?:181b20|1a1d22|1c2026|202329|20242a|101216)/);
    assert.doesNotMatch(startOrderCss, /linear-gradient\(180deg,\s*#31353d/);
});

test('Docker page sync hook is guarded and triggers autostart sync after relevant saves', () => {
    assert.match(dockerJs, /if \(!data\.has\('names'\)\)/);
    assert.match(dockerJs, /scheduleDockerOrderSync/);
    assert.match(dockerJs, /server\/sync_order\.php/);
    assert.match(dockerJs, /ajaxComplete/);
    assert.match(dockerJs, /data\.has\('names'\) \|\| data\.has\('reset'\)/);
    assert.match(dockerJs, /\['autostart', 'wait'\]\.includes\(data\.get\('action'\)\)/);
});
