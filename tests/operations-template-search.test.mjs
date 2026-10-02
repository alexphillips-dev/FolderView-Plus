import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { createApi } = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-workspaces.js');

test('template search narrows saved choices and empty call to action targets creation', () => {
    const htmlBySelector = new Map();
    const queryBySelector = new Map([['#docker-operations-template-search', 'arr']]);
    const $ = (selector) => ({
        length: 1,
        val: () => queryBySelector.get(selector) || '',
        html: (value) => htmlBySelector.set(selector, value),
        text: () => {}
    });
    const templatesByType = {
        docker: [{ id: 'arr', name: 'Arr apps' }, { id: 'media', name: 'Media' }],
        vm: []
    };
    const api = createApi({
        $,
        templatesByType,
        getFolderMap: () => ({ target: { name: 'Target' } }),
        escapeHtml: (value) => String(value ?? ''),
        formatTimestamp: () => ''
    });

    api.filterOperationsTemplates('docker');
    assert.match(htmlBySelector.get('#docker-operations-template-library'), /Arr apps/);
    assert.doesNotMatch(htmlBySelector.get('#docker-operations-template-library'), /<option value="media"/);

    queryBySelector.set('#docker-operations-template-search', 'missing');
    api.filterOperationsTemplates('docker');
    assert.match(htmlBySelector.get('#docker-operations-template-library'), /No matching templates/);

    api.renderTemplateRows('vm');
    assert.match(htmlBySelector.get('#vm-operations-template-library'), /Create your first template/);
    assert.match(htmlBySelector.get('#vm-operations-template-library'), /data-fv-operations-create-cta="vm"/);
});

test('Operations binds search and create shortcuts once across repeated renders', () => {
    const listeners = { search: [], library: [] };
    const search = {
        dataset: {},
        addEventListener: (_event, handler) => listeners.search.push(handler),
        getAttribute: () => 'docker'
    };
    const library = {
        dataset: {},
        addEventListener: (_event, handler) => listeners.library.push(handler),
        contains: () => true
    };
    let focused = 0;
    let rendered = '';
    const api = createApi({
        $: (selector) => ({
            length: 1,
            val: () => selector === '#docker-operations-template-search' ? 'media' : '',
            html: (value) => { rendered = value; }
        }),
        document: {
            querySelectorAll: (selector) => selector === '[data-fv-operations-template-search]' ? [search]
                : selector === '.fv-operations-template-library' ? [library] : [],
            getElementById: () => ({ focus: () => { focused += 1; } })
        },
        templatesByType: { docker: [{ id: 'media', name: 'Media' }], vm: [] },
        getFolderMap: () => ({}),
        escapeHtml: (value) => String(value ?? '')
    });
    api.renderOperationsWorkspace();
    api.renderOperationsWorkspace();
    assert.equal(listeners.search.length, 1);
    assert.equal(listeners.library.length, 1);
    listeners.search[0]();
    assert.match(rendered, /Media/);
    listeners.library[0]({ target: { closest: () => ({ getAttribute: () => 'docker' }) } });
    assert.equal(focused, 1);
});
