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
