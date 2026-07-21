import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const modulePath = path.resolve(
    process.cwd(),
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/runtime.host-adapter.js'
);
const hostAdapters = require(modulePath);

const createRow = ({ type = 'item', name = '' } = {}) => ({
    id: name,
    dataset: name ? { name } : {},
    matches(selector) {
        if (type === 'folder') return selector === 'tr.folder';
        if (type === 'detail') return selector.includes('data-fv-native-detail-row') || selector.includes('vm-details');
        return selector.includes('sortable:not(.folder)');
    },
    querySelector() {
        return name ? { dataset: { name }, textContent: name } : null;
    },
    getAttribute(attribute) {
        return attribute === 'data-name' ? name : '';
    }
});

const createDocument = (type = 'docker', rows = []) => {
    const contract = hostAdapters.CONTRACTS[type];
    const table = { querySelector: () => header };
    const header = { id: `${type}-header` };
    const body = {
        closest: () => table,
        querySelectorAll(selector) {
            if (selector === ':scope > tr') return rows;
            return rows.filter((row) => row.matches(selector));
        }
    };
    const selectors = new Map([
        [contract.tableSelector, table],
        [contract.headerSelector, header],
        [contract.bodySelectors[0], body]
    ]);
    return { document: { querySelector: (selector) => selectors.get(selector) || null }, table, header, body };
};

test('Docker and VM adapters expose one shared immutable host contract', () => {
    assert.deepEqual(Object.keys(hostAdapters.CONTRACTS), ['docker', 'vm']);
    assert.equal(Object.isFrozen(hostAdapters.CONTRACTS.docker), true);
    assert.equal(Object.isFrozen(hostAdapters.CONTRACTS.vm.requiredSelectors), true);
    assert.deepEqual(hostAdapters.CONTRACTS.docker.allowedHooks, [
        'loadlist',
        'listview',
        'openDocker',
        'eventControl',
        'addDockerContainerContext'
    ]);
    assert.deepEqual(hostAdapters.CONTRACTS.vm.allowedHooks, [
        'loadlist',
        'addVMContext',
        'ajaxVMDispatch',
        'ajaxVMDispatchconsole',
        'ajaxVMDispatchconsoleRV'
    ]);
});

test('host adapters normalize DOM discovery and row identity for Docker and VM', () => {
    for (const type of ['docker', 'vm']) {
        const rows = [
            createRow({ type: 'folder' }),
            createRow({ name: `${type}-item` }),
            createRow({ type: 'detail' })
        ];
        const fixture = createDocument(type, rows);
        const adapter = hostAdapters.createHostAdapter(type, {
            window: { document: fixture.document },
            document: fixture.document
        });
        assert.deepEqual(adapter.ensureStructure({ throwOnError: false }), { ok: true, missing: [] });
        assert.equal(adapter.getTable(), fixture.table);
        assert.equal(adapter.getHeaderRow(), fixture.header);
        assert.equal(adapter.getPrimaryBody(), fixture.body);
        assert.equal(adapter.queryRows('folder').length, 1);
        assert.equal(adapter.queryRows('item').length, 1);
        assert.equal(adapter.queryRows('detail').length, 1);
        assert.equal(adapter.getRowIdentity(adapter.queryRows('item')[0]), `${type}-item`);
        assert.equal(adapter.getSnapshot().structure.valid, true);
    }
});

test('host hook wrapping is idempotent, preserves this and arguments, and restores the original', () => {
    const fixture = createDocument('docker');
    const calls = [];
    const host = {
        document: fixture.document,
        prefix: 'host',
        loadlist(value) {
            calls.push([this.prefix, value]);
            return `original:${value}`;
        }
    };
    const adapter = hostAdapters.createHostAdapter('docker', { window: host, document: fixture.document });
    const first = adapter.wrapHook('loadlist', ({ args, invokeOriginal }) => invokeOriginal(`${args[0]}-first`), {
        legacyAlias: 'loadlist_original'
    });
    const second = adapter.wrapHook('loadlist', ({ args, invokeOriginal }) => invokeOriginal(`${args[0]}-second`), {
        legacyAlias: 'loadlist_original'
    });
    assert.equal(first, second);
    assert.equal(host.loadlist('refresh'), 'original:refresh-second');
    assert.deepEqual(calls, [['host', 'refresh-second']]);
    assert.equal(adapter.getSnapshot().hooks.loadlist.callCount, 1);
    adapter.restoreHook('loadlist');
    assert.equal(host.loadlist, host.loadlist_original);
    assert.throws(() => adapter.wrapHook('startVm', () => {}, {}), /does not allow/);
});

test('row observers are independently subscribed, batched, and disposed together', async () => {
    const fixture = createDocument('vm', [createRow({ name: 'vm-one' })]);
    const observerInstances = [];
    class FakeMutationObserver {
        constructor(callback) {
            this.callback = callback;
            this.disconnected = false;
            observerInstances.push(this);
        }
        observe() {}
        disconnect() { this.disconnected = true; }
    }
    const adapter = hostAdapters.createHostAdapter('vm', {
        window: { document: fixture.document, MutationObserver: FakeMutationObserver },
        document: fixture.document,
        MutationObserver: FakeMutationObserver
    });
    const deliveries = [];
    adapter.observeRows(({ records }) => deliveries.push(['first', records.length]));
    adapter.observeRows(({ records }) => deliveries.push(['second', records.length]));
    observerInstances[0].callback([{ id: 1 }]);
    observerInstances[0].callback([{ id: 2 }]);
    observerInstances[1].callback([{ id: 3 }]);
    await Promise.resolve();
    await Promise.resolve();
    assert.deepEqual(deliveries, [['first', 2], ['second', 1]]);
    assert.equal(adapter.getSnapshot().structure.observerCount, 2);
    adapter.dispose();
    assert.equal(observerInstances.every((observer) => observer.disconnected), true);
    assert.equal(adapter.getSnapshot().structure.observerCount, 0);
});

test('missing host structure returns diagnostics or throws the categorized host error', () => {
    const document = { querySelector: () => null };
    const adapter = hostAdapters.createHostAdapter('docker', { window: { document }, document });
    const result = adapter.ensureStructure({ throwOnError: false });
    assert.equal(result.ok, false);
    assert.equal(result.missing.length, 3);
    assert.equal(result.error.fvplusPhase, 'host-dom');
    assert.equal(result.error.fvplusCategory, 'host-page-structure');
    assert.throws(() => adapter.ensureStructure(), /Expected Docker host page selectors/);
});
