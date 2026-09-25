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
    const properties = new Map();
    const labels = new Map();
    const dialogs = [];
    const outputs = [];
    const executions = [];
    let itemState = 'stopped';
    const $ = (selector) => ({
        val: () => values.get(selector),
        prop(name, value) {
            properties.set(`${selector}:${name}`, value);
            return this;
        },
        find() {
            return { text: (value) => labels.set(selector, value) };
        }
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
    assert.equal(properties.get('#docker-runtime-apply:disabled'), false);
    assert.equal(properties.get('#docker-runtime-apply:hidden'), false);
    assert.equal(labels.get('#docker-runtime-apply'), 'Apply action (1 eligible)');

    values.set('#docker-runtime-action', 'stop');
    api.invalidateFolderRuntimePreview('docker');
    assert.equal(properties.get('#docker-runtime-apply:hidden'), true);
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
    assert.equal(properties.get('#docker-runtime-apply:hidden'), true);
    assert.equal(outputs.at(-1), 'result');
});
