import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { runInventoryRepair } from './helpers/runtime-inventory-fixture.mjs';

const require = createRequire(import.meta.url);
const { createApi } = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.runtime-actions.js');
const utils = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.utils.js');

test('Settings Branch Import plans against the fresh revision and only creates remapped IDs', async () => {
    const root = { name: 'Target folder' };
    const folders = { root, branch: { name: 'Peer folder' } };
    const payload = utils.buildFullExportPayload({ type: 'docker', pluginVersion: 'fixture', folders: {
        branch: { name: 'New branch' }, leaf: { name: 'New leaf', parentId: 'branch' }
    } });
    for (const folderRevision of [1, null]) {
        const results = [], errors = [], checkpoints = [];
        const api = createApi({
            utils,
            getFolderMap: () => ({ root }),
            fetchFolders: async () => ({ folders, folderRevision }),
            selectJsonFile: async () => ({ text: JSON.stringify(payload) }),
            createBackup: async () => checkpoints.push('checkpoint'),
            showError: (_title, error) => errors.push(error.message),
            applyImportOperations: async (type, operations, _progress, { expectedRevision }) => {
                assert.equal(expectedRevision, folderRevision);
                results.push(runInventoryRepair({ type, operation: 'batch', scenario: 'healthy',
                    dockerFolders: folders, expectedRevision, batchOperations: { ...operations, preserveParentLinks: true } }));
            }
        });
        await api.importFolderBranch('docker', 'root');
        if (folderRevision === null) {
            assert.equal(errors.length, 1);
            assert.deepEqual(checkpoints, []);
            assert.deepEqual(results, []);
            continue;
        }
        assert.deepEqual(errors, []);
        assert.deepEqual(checkpoints, ['checkpoint']);
        const [result] = results;
        assert.equal(result.responseStatus, 200);
        assert.deepEqual(result.response.result.createdIds, ['branch-1', 'leaf']);
        assert.equal(result.folders.branch.name, 'Peer folder');
        assert.equal(result.folders['branch-1'].parentId, 'root');
        assert.equal(result.folders.leaf.parentId, 'branch-1');
    }
});

test('folder actions require a current eligible preview before opening confirmation', async () => {
    const values = new Map([
        ['#docker-runtime-folder', 'media'],
        ['#docker-runtime-action', 'start']
    ]);
    const dialogs = [];
    const outputs = [];
    const executions = [];
    let itemState = 'stopped';
    const $ = (selector) => ({
        val: () => values.get(selector),
        prop() { return this; }
    });
    const api = createApi({
        $,
        escapeHtml: String,
        window: { FolderViewPlusUI: { confirm: async options => { dialogs.push(options); return true; }, alert: () => {} } },
        getFolderNameForId: () => 'Media',
        getRuntimePlanForFolder: () => ({
            requestedCount: 1,
            eligible: [{ name: 'container-one', state: itemState }],
            skipped: []
        }),
        buildRuntimePreviewHtml: (_type, _folder, _action, _plan, result) => result ? 'result' : 'preview',
        setRuntimePreviewOutput: (_type, html) => outputs.push(html),
        refreshType: async () => ({ runtimeFetched: true }),
        executeFolderRuntimeAction: async (type, folderId, action, names) => {
            executions.push({ type, folderId, action, names });
            return { executed: 1, succeeded: 1, failed: 0, skipped: [] };
        }
    });

    values.set('#docker-runtime-folder', '');
    api.previewFolderRuntimeAction('docker');
    assert.match(outputs.at(-1), /Select a folder and action first/);
    assert.match(outputs.at(-1), /want to preview/);
    await api.applyFolderRuntimeAction('docker');
    assert.match(outputs.at(-1), /want to apply/);
    assert.equal(dialogs.length, 0);
    values.set('#docker-runtime-folder', 'media');
    await api.applyFolderRuntimeAction('docker');
    assert.equal(dialogs.length, 0);
    assert.match(outputs.at(-1), /Preview this action/);

    api.previewFolderRuntimeAction('docker');
    assert.equal(outputs.at(-1), 'preview');

    values.set('#docker-runtime-action', 'stop');
    api.invalidateFolderRuntimePreview('docker');
    assert.equal(outputs.at(-1), '');
    await api.applyFolderRuntimeAction('docker');
    assert.equal(dialogs.length, 0);

    values.set('#docker-runtime-action', 'start');
    api.previewFolderRuntimeAction('docker');
    itemState = 'running';
    await api.applyFolderRuntimeAction('docker');
    assert.equal(dialogs.length, 0);
    assert.match(outputs.at(-1), /Folder state changed/);

    api.previewFolderRuntimeAction('docker');
    await api.applyFolderRuntimeAction('docker');
    assert.equal(dialogs.length, 1);
    assert.deepEqual(executions, [{ type: 'docker', folderId: 'media', action: 'start', names: ['container-one'] }]);
    assert.equal(outputs.at(-1), 'result');
});

test('folder action reports command results independently of refresh and observed state', async () => {
    const fetched = async () => ({ runtimeFetched: true });
    const unconfirmed = 'Current runtime status could not be confirmed.';
    for (const [name, refreshType, state, failed, warningText, type = 'docker', action = 'start'] of [
        ['verified', fetched, 'started', 0, ''],
        ['not observed', fetched, 'stopped', 0, unconfirmed],
        ['missing item', fetched, null, 0, unconfirmed, 'docker', 'stop'],
        ['unknown VM', fetched, 'unknown', 0, unconfirmed, 'vm', 'pause'],
        ['degraded', async () => ({ hasErrors: true, runtimeFetched: true }), 'started', 0, 'Refresh failed.'],
        ['omitted inventory', async () => ({ hasErrors: false }), 'started', 0, 'Refresh failed.'],
        ['rejected refresh', async () => { throw Error('fixture refresh'); }, 'started', 0, 'Refresh failed.'],
        ['partial', fetched, 'started', 1, '']
    ]) {
        const alerts = [], errors = [], outputs = [], events = [];
        const api = createApi({
            $: selector => ({ val: () => selector.endsWith('-folder') ? 'media' : action }),
            window: { FolderViewPlusUI: { confirm: async () => true, alert: options => alerts.push(options) } },
            getRuntimePlanForFolder: () => ({
                requestedCount: 2, eligible: [{ name: 'item-a', state: 'stopped' }, { name: 'item-b', state: 'stopped' }], skipped: []
            }),
            getRuntimeInfo: () => state ? { 'item-a': { state }, 'item-b': { state } } : {},
            executeFolderRuntimeAction: async () => {
                return { executed: 2, succeeded: 2 - failed, failed, results: [
                    { item: 'item-a', ok: true }, { item: 'item-b', ok: !failed }
                ] };
            },
            refreshType: async (_type, options) => options?.render === false ? fetched() : refreshType(),
            getFolderNameForId: () => 'Media',
            buildRuntimePreviewHtml: (_type, _folder, _action, _plan, result) => result || 'preview',
            setRuntimePreviewOutput: (_type, html, status) => outputs.push({ html, status }),
            trackDiagnosticsEvent: event => events.push(event),
            showError: (...args) => errors.push(args)
        });
        api.previewFolderRuntimeAction(type);
        await api.applyFolderRuntimeAction(type);
        assert.equal(alerts.at(-1).tone, name === 'verified' ? 'success' : 'warning', name);
        assert.match(alerts.at(-1).message, new RegExp(`succeeded: ${2 - failed}, failed: ${failed}`), name);
        assert.equal(outputs.at(-1).html.notice, warningText, name);
        assert.equal(events.at(-1).status, name === 'verified' ? 'ok' : 'warning', name);
        assert.deepEqual(errors, [], name);
    }
});

test('a stale confirmation cannot dispatch after membership or selection changes', async () => {
    for (const change of ['member', 'selection', 'refresh', 'cancel']) {
        let member = 'before', folder = 'media', callback, confirmations = 0, dispatched = 0, output;
        const api = createApi({
            $: selector => ({ val: () => selector.endsWith('-folder') ? folder : 'stop' }),
            escapeHtml: String,
            window: { FolderViewPlusUI: { confirm: () => new Promise(resolve => { confirmations++; callback = resolve; }) } },
            getRuntimePlanForFolder: () => ({ requestedCount: 1, eligible: [{ name: member, state: 'started' }], skipped: [] }),
            setRuntimePreviewOutput: (_type, html) => { output = html; },
            refreshType: async () => ({ runtimeFetched: change !== 'refresh' }),
            executeFolderRuntimeAction: async () => { dispatched++; }
        });
        api.previewFolderRuntimeAction('docker');
        const pending = api.applyFolderRuntimeAction('docker');
        await api.applyFolderRuntimeAction('docker');
        assert.equal(confirmations, 1, change);
        if (change === 'member') member = 'after';
        if (change === 'selection') folder = 'another';
        callback(change !== 'cancel');
        await pending;
        assert.equal(dispatched, 0, change);
        if (change !== 'cancel') assert.match(output, /Folder state changed/, change);
    }
});
