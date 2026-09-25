import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { createApi } = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.runtime-actions.js');

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
        swal: (options, callback) => dialogs.push({ options, callback }),
        getFolderNameForId: () => 'Media',
        getRuntimePlanForFolder: () => ({
            requestedCount: 1,
            eligible: [{ name: 'container-one', state: itemState }],
            skipped: []
        }),
        buildRuntimePreviewHtml: (_type, _folder, _action, _plan, result) => result ? 'result' : 'preview',
        setRuntimePreviewOutput: (_type, html) => outputs.push(html),
        executeFolderRuntimeAction: async (type, action, names) => {
            executions.push({ type, action, names });
            return { executed: 1, succeeded: 1, failed: 0, skipped: [] };
        }
    });

    api.applyFolderRuntimeAction('docker');
    assert.equal(dialogs.length, 0);
    assert.match(outputs.at(-1), /Preview this action/);

    api.previewFolderRuntimeAction('docker');
    assert.equal(outputs.at(-1), 'preview');

    values.set('#docker-runtime-action', 'stop');
    api.invalidateFolderRuntimePreview('docker');
    assert.equal(outputs.at(-1), '');
    api.applyFolderRuntimeAction('docker');
    assert.equal(dialogs.length, 0);

    values.set('#docker-runtime-action', 'start');
    api.previewFolderRuntimeAction('docker');
    itemState = 'running';
    api.applyFolderRuntimeAction('docker');
    assert.equal(dialogs.length, 0);
    assert.match(outputs.at(-1), /Folder state changed/);

    api.previewFolderRuntimeAction('docker');
    api.applyFolderRuntimeAction('docker');
    assert.equal(dialogs.length, 1);
    await dialogs[0].callback(true);
    assert.deepEqual(executions, [{ type: 'docker', action: 'start', names: ['container-one'] }]);
    assert.equal(outputs.at(-1), 'result');
});
