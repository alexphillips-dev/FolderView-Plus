import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pluginRoot = path.join(process.cwd(), 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus');
const viewSettings = require(path.join(pluginRoot, 'scripts/folderviewplus.view-settings.js'));

test('view settings UI state normalization rejects stale shapes and normalizes both managed types', () => {
    const normalized = viewSettings.normalizeUiState({
        filters: { docker: { folders: ' RUNNING ' }, vm: 'stale' },
        quick: { docker: 'PINNED', vm: '' },
        healthSeverity: { docker: 'WARN' },
        treeCollapsed: { docker: [' one ', '', null], vm: 'stale' },
        treeReorderMode: { vm: true },
        advancedSearch: { queryByTab: { folders: 'needle' }, basicQuery: ' TEXT ', searchAll: true }
    });
    assert.equal(normalized.filters.docker.folders, 'running');
    assert.equal(normalized.filters.vm.folders, '');
    assert.equal(normalized.quick.docker, 'pinned');
    assert.equal(normalized.quick.vm, 'all');
    assert.equal(normalized.healthSeverity.docker, 'warn');
    assert.deepEqual(normalized.treeCollapsed.docker, ['one']);
    assert.deepEqual(normalized.treeCollapsed.vm, []);
    assert.equal(normalized.treeReorderMode.vm, true);
    assert.deepEqual(normalized.advancedSearch.byTab, { folders: 'needle' });
    assert.equal(normalized.advancedSearch.basicQuery, 'text');
});

test('view settings state store persists normalized state and fails closed on corrupt storage', () => {
    const values = new Map();
    const storage = {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value)
    };
    const store = viewSettings.createUiStateStore({ storage, storageKey: 'view-state' }).start();
    assert.equal(store.save({ quick: { docker: 'PINNED' } }), true);
    assert.equal(store.restore().quick.docker, 'pinned');
    values.set('view-state', '{invalid');
    assert.equal(store.restore(), null);
    assert.match(store.snapshot().lastError, /JSON/);
    store.destroy();
    assert.equal(store.save({}), false);
    assert.equal(store.restore(), null);
});

test('range-control lifecycle owns one namespaced binding and removes it on destroy', () => {
    const calls = [];
    const chain = {
        on: (eventName) => { calls.push(['on', eventName]); return chain; },
        off: (namespace) => { calls.push(['off', namespace]); return chain; }
    };
    const jq = () => chain;
    const lifecycle = viewSettings.createRangeControlLifecycle({ document: {}, window: {}, $: jq });
    lifecycle.start();
    lifecycle.start();
    assert.equal(calls.filter(([operation]) => operation === 'on').length, 3);
    lifecycle.destroy();
    assert.deepEqual(calls.at(-1), ['off', '.fvViewSettingsRange']);
    assert.equal(lifecycle.snapshot().started, false);
});

const createNumberControls = () => {
    const bindings = [];
    const range = { tagName: 'INPUT', value: '60', min: '0', max: '100', dataset: { fvNumberTarget: 'docker-health-warn-threshold' }, style: { setProperty() {} } };
    const input = { id: 'docker-health-warn-threshold', value: '60', parentElement: { querySelector: () => range } };
    const doc = { activeElement: input, getElementById: id => id === input.id ? input : null, querySelectorAll: () => [range] };
    const chain = {
        on: (events, selector, handler) => { bindings.push({ events, selector, handler }); return chain; },
        off: () => { bindings.length = 0; }
    };
    const lifecycle = viewSettings.createRangeControlLifecycle({ document: doc, window: { Event: class { constructor(type) { this.type = type; } } }, $: () => chain }).start();
    const dispatch = (node, type) => {
        const selector = node === range ? '[data-fv-number-target]' : 'input[type="number"]';
        bindings.filter(binding => binding.selector.includes(selector) && binding.events.split(' ').some(event => event.split('.')[0] === type))
            .forEach(binding => binding.handler.call(node, { type }));
    };
    input.dispatchEvent = event => dispatch(input, event.type);
    return { lifecycle, input, range, doc, dispatch };
};

test('number drafts survive refreshes until change, then accept normalized and rollback values', () => {
    const { lifecycle, input, range, dispatch } = createNumberControls();
    input.value = '0'; dispatch(input, 'input');
    lifecycle.setNumberValue(input.id, 60); lifecycle.refresh('docker');
    assert.equal(input.value, '0'); assert.equal(range.value, '0');
    input.value = '20'; dispatch(input, 'input'); dispatch(input, 'change');
    lifecycle.setNumberValue(input.id, 65); lifecycle.refresh('docker');
    assert.equal(input.value, '65'); assert.equal(range.value, '65');
    lifecycle.setNumberValue(input.id, 60);
    assert.equal(input.value, '60', 'failed saves can restore the authoritative value');
});

test('paired slider drafts survive refresh and commit through the number control', () => {
    const { lifecycle, input, range, doc, dispatch } = createNumberControls();
    doc.activeElement = range; range.value = '25'; dispatch(range, 'input');
    lifecycle.setNumberValue(input.id, 60); lifecycle.refresh('docker');
    assert.equal(input.value, '25'); assert.equal(range.value, '25');
    dispatch(range, 'change'); lifecycle.setNumberValue(input.id, 30); lifecycle.refresh('docker');
    assert.equal(input.value, '30'); assert.equal(range.value, '30');
});

test('blur and lifecycle cleanup release stale number drafts without duplicate bindings', () => {
    const { lifecycle, input, doc, dispatch } = createNumberControls();
    input.value = ''; dispatch(input, 'input');
    lifecycle.setNumberValue(input.id, 60); assert.equal(input.value, '');
    dispatch(input, 'focusout'); doc.activeElement = null;
    lifecycle.setNumberValue(input.id, 60); assert.equal(input.value, '60');
    doc.activeElement = input; input.value = '25'; dispatch(input, 'input');
    lifecycle.destroy(); lifecycle.start(); lifecycle.setNumberValue(input.id, 60);
    assert.equal(input.value, '60');
    lifecycle.setNumberValue('removed-control', 1);
});
