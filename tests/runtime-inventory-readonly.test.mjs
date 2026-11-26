import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { runInventoryRepair } from './helpers/runtime-inventory-fixture.mjs';

test('read-only inventory endpoints preserve exact native autostart bytes through empty, failed and partial reads', () => {
    for (const operation of ['read', 'snapshot', 'diagnostics']) {
        for (const scenario of ['healthy', 'empty', 'failed-list', 'failed-detail', 'malformed-list']) {
            const result = runInventoryRepair({ type: 'docker', operation, scenario });
            assert.equal(result.error, '', `${operation}/${scenario}: ${result.error}`);
            assert.equal(result.native, result.nativeBefore, `${operation}/${scenario} must be observational`);
            assert.equal(result.nativeMode, result.nativeModeBefore);
            assert.ok(result.response);
            assert.notEqual(result.response.ok, false, `${operation}/${scenario} must execute a successful read`);
        }
    }
});

test('diagnostics reports saved orphaned members only after a complete inventory listing', () => {
    for (const type of ['docker', 'vm']) {
        for (const [scenario, verified, count] of [
            ['healthy', true, 1], ['failed-detail', true, 1], ['empty', true, 2],
            ['failed-list', false, 0], ['malformed-list', false, 0]
        ]) {
            const result = runInventoryRepair({ type, operation: 'diagnostics', scenario });
            const label = `${type}/${scenario}`;
            assert.equal(result.error, '', label);
            assert.equal(result.responseStatus, 200, label);
            assert.equal(result.native, result.nativeBefore, label);
            const diagnostics = result.response.diagnostics;
            const orphans = diagnostics.types[type].integrityChecks.orphanedMembers;
            assert.equal(orphans.inventoryVerified, verified, label);
            assert.equal(orphans.count, count, label);
            assert.equal(orphans.folders.length, count > 0 ? 1 : 0, label);
            assert.equal(diagnostics.summary.recommendedActions.some(action => action.action === 'repair_orphaned_members'), count > 0, label);
        }
    }
});

test('state reads, VM reads and start-order previews leave native autostart unchanged', () => {
    for (const request of [{ type: 'docker', operation: 'read', mode: 'state', scenario: 'healthy' },
        { type: 'docker', operation: 'snapshot', mode: 'state', scenario: 'healthy' },
        { type: 'vm', operation: 'read', scenario: 'disabled' },
        { type: 'docker', operation: 'preview', scenario: 'healthy' }]) {
        const result = runInventoryRepair(request);
        assert.equal(result.error, '');
        assert.equal(result.native, result.nativeBefore);
        assert.notEqual(result.response.ok, false);
    }
});

test('unmanaged start-order preview keeps native wait values and managed mode still uses saved overrides', () => {
    for (const [mode, wait, waitSource] of [['unmanaged', 19, 'native'], ['docker-page', 73, 'container']]) {
        const result = runInventoryRepair({ type: 'docker', operation: 'preview', scenario: 'healthy',
            plan: { mode, containerWaits: { 'docker-extra': 73 } } });
        assert.equal(result.error, '');
        assert.equal(result.responseStatus, 200);
        assert.equal(result.native, result.nativeBefore);
        const preview = result.response.preview;
        assert.deepEqual(preview.sequence.find(entry => entry.name === 'docker-extra'),
            { name: 'docker-extra', wait, waitSource, batchId: '' });
    }
});

test('cached full and state reads preserve native bytes without runtime discovery', () => {
    for (const operation of ['read', 'snapshot']) for (const mode of ['full', 'state']) {
        const result = runInventoryRepair({ type: 'docker', operation, scenario: 'stale-cache', mode, force: false });
        assert.equal(result.error, '');
        assert.notEqual(result.response.ok, false);
        assert.equal(result.native, result.nativeBefore);
        assert.deepEqual(result.calls, []);
    }
});

test('fresh and previously cached Docker details omit environment values from runtime reads', () => {
    const name = 'docker-present';
    const config = { Image: 'fixture/image:latest', Env: ['FVPLUS_FIXTURE_TOKEN=fixture-value-that-must-stay-server-side'] };
    for (const operation of ['read', 'snapshot']) {
        for (const cached of [false, true]) {
            const result = runInventoryRepair({
                type: 'docker', operation, scenario: 'healthy', mode: 'full', force: !cached,
                details: { [name]: { Config: config, State: { Running: false }, HostConfig: { NetworkMode: 'host' } } },
                cachedRuntimeDetails: cached ? { [name]: { info: { Name: name, Config: config } } } : undefined
            });
            assert.equal(result.error, '');
            assert.ok(result.response);
            const runtime = operation === 'snapshot' ? result.response.runtime : result.response;
            assert.equal(runtime[name].info.Config.Image, config.Image);
            assert.equal(Object.hasOwn(runtime[name].info.Config, 'Env'), false);
            assert.equal(JSON.stringify(result.response).includes('fixture-value-that-must-stay-server-side'), false);
            assert.equal(result.native, result.nativeBefore);
            if (cached) assert.deepEqual(result.calls, []);
        }
    }
});

test('explicit managed sync uses fresh authority to remove stale records in Docker page order with native waits', () => {
    for (const scenario of ['healthy', 'stale-cache', 'failed-detail']) {
        const result = runInventoryRepair({ type: 'docker', operation: 'sync', scenario });
        assert.equal(result.error, '');
        assert.equal(result.response.ok, true);
        assert.equal(result.response.syncOutcome, 'synced');
        assert.equal(result.native, 'docker-present 7\ndocker-extra 19\n');
        assert.ok(result.calls.some(([call, count]) => call === 'docker-list' && count === 5));
        assert.ok(result.calls.every(([call]) => call !== 'docker-cached-list'));
    }
});

test('start-order sync preserves a numeric container and uses it once in the native file', () => {
    const result = runInventoryRepair({ type: 'docker', operation: 'start-sync', scenario: 'healthy',
        docker: ['12', 'docker-extra'].map((name, index) => ({ Names: ['/' + name], Id: String(index + 1).repeat(64), State: 'exited' })),
        nativeAutostart: 'docker-extra 19\n12 7\nstale-host-entry 31\n' });
    assert.equal(result.response.syncOutcome, 'synced');
    assert.deepEqual(result.response.preview.autostartOrder, ['12', 'docker-extra']);
    assert.deepEqual(result.response.preview.staleAutostart, ['stale-host-entry']);
    assert.equal(result.native, '12 7\ndocker-extra 19\n');
});

test('custom batch waits follow unique scheduled containers and the folder order toggle uses native order', () => {
    const fixture = { type: 'docker', operation: 'start-sync', scenario: 'healthy',
        dockerFolder: { name: 'Fixture', containers: ['docker-present', 'docker-extra'] } };
    const folderItem = { type: 'folder', id: 'fixture' };
    const overlapping = runInventoryRepair({ ...fixture, plan: { mode: 'custom-batches', batches: [
        { id: 'first', delay: 10, items: [{ type: 'container', name: 'docker-extra' }] },
        { id: 'second', delay: 40, items: [folderItem] }
    ] } });
    assert.equal(overlapping.response.syncOutcome, 'synced');
    assert.deepEqual(overlapping.response.preview.batches.map(batch => batch.containers), [['docker-extra'], ['docker-present']]);
    assert.equal(overlapping.native, 'docker-extra 10\ndocker-present 40\n');
    for (const useFolderOrder of [true, false]) {
        const result = runInventoryRepair({ ...fixture, plan: { mode: 'custom-batches',
            batches: [{ id: 'single', useFolderOrder, items: [folderItem] }] } });
        assert.equal(result.response.syncOutcome, 'synced');
        assert.deepEqual(result.response.preview.autostartOrder, useFolderOrder
            ? ['docker-present', 'docker-extra'] : ['docker-extra', 'docker-present']);
    }
});

test('runtime responses stay valid JSON when the native Docker SDK writes a socket error', () => {
    for (const operation of ['read', 'snapshot']) for (const mode of ['state', 'full']) {
        const result = runInventoryRepair({ type: 'docker', operation, mode, scenario: 'socket-output' });
        assert.equal(result.error, '', `${operation}/${mode}`);
        assert.equal(result.responseStatus, 503);
        assert.equal(result.response.ok, false);
        assert.doesNotMatch(JSON.stringify(result.response), /synthetic-private-socket-detail/);
    }
    const details = runInventoryRepair({ type: 'docker', operation: 'snapshot', mode: 'full', scenario: 'detail-output' });
    assert.equal(details.error, '');
    assert.equal(details.responseStatus, 200);
    assert.doesNotMatch(JSON.stringify(details.response), /synthetic-private-socket-detail/);
    const diagnostics = runInventoryRepair({ type: 'docker', operation: 'diagnostics', scenario: 'late-socket-output' });
    assert.equal(diagnostics.error, '');
    assert.equal(diagnostics.responseStatus, 200);
    assert.equal(diagnostics.response.ok, true);
    assert.doesNotMatch(JSON.stringify(diagnostics.response), /synthetic-private-socket-detail/);
    const connectivity = diagnostics.response.diagnostics.summary.cards.find(card => card.key === 'runtime_connectivity');
    assert.notEqual(connectivity.states.docker, 'ready');
});

const explicitOrderRequests = ['sync', 'start-sync'];
const explicitOrderFixture = (operation, options) => runInventoryRepair({
    type: 'docker', operation, scenario: 'healthy', ...options
});

test('a managed autostart toggle updates only the target record and preserves the native Docker page order', () => {
    const nativePageOrder = '0="docker-extra"\n1="docker-new"\n2="docker-present"\n';
    const docker = ['docker-extra', 'docker-new', 'docker-present'].map((name, index) => ({
        Id: String(index + 1).repeat(64), Names: [`/${name}`], Image: 'fixture/image:latest', State: 'exited'
    }));
    const nativeAutostart = 'docker-extra 7200\r\nstale-host-entry 31\ndocker-present 19\n';
    const plan = {
        mode: 'custom-batches',
        batches: [{ id: 'fixture', name: 'Fixture', items: ['docker-extra', 'docker-new', 'docker-present'].map(name => ({ type: 'container', name })) }],
        containerWaits: { 'docker-extra': 99, 'docker-new': 23 }
    };
    const options = { nativeAutostart, nativePageOrder, plan, docker, container: 'docker-new', enabled: '1' };
    const enabled = explicitOrderFixture('start-toggle', options);
    assert.equal(enabled.error, '');
    assert.equal(enabled.responseStatus, 200);
    assert.equal(enabled.response?.enabled, true);
    assert.equal(enabled.native, 'docker-extra 7200\r\nstale-host-entry 31\ndocker-new 23\ndocker-present 19\n');
    assert.equal(enabled.nativePageOrder, nativePageOrder);
    assert.equal(enabled.nativeMode, enabled.nativeModeBefore);

    const disabled = explicitOrderFixture('start-toggle', { ...options, enabled: '0', nativeAutostart: enabled.native });
    assert.equal(disabled.responseStatus, 200);
    assert.equal(disabled.response?.enabled, false);
    assert.equal(disabled.native, nativeAutostart);
    assert.equal(disabled.nativePageOrder, nativePageOrder);

    const repeated = explicitOrderFixture('start-toggle', { ...options, nativeAutostart: enabled.native });
    assert.equal(repeated.response?.enabled, true);
    assert.equal(repeated.native, enabled.native);

    for (const overrides of [
        { plan: { mode: 'unmanaged' } }, { syncLock: 'held' }, { container: 'docker-unknown' },
        { container: '../../outside' }, { withoutToken: true }
    ]) {
        const rejected = explicitOrderFixture('start-toggle', { ...options, ...overrides });
        assert.equal(rejected.response?.ok, false, JSON.stringify(overrides));
        assert.equal(rejected.native, nativeAutostart);
        assert.equal(rejected.nativePageOrder, nativePageOrder);
    }
});

test('autostart toggle moves a recorded batch wait to the last enabled member and full sync is idempotent', () => {
    const plan = { mode: 'custom-batches', batches: [{ id: 'batch', delay: 30,
        items: ['docker-present', 'docker-extra'].map(name => ({ type: 'container', name })) }] };
    const initial = explicitOrderFixture('start-sync', { plan, nativeAutostart: 'docker-present 7\ndocker-extra 7200\n' });
    assert.equal(initial.native, 'docker-present 7\ndocker-extra 30\n');
    assert.deepEqual(initial.batchWaitState.active['docker-extra'], { applied: 'docker-extra 30', original: 'docker-extra 7200' });
    const disabled = explicitOrderFixture('start-toggle', { plan, container: 'docker-extra', enabled: '0',
        nativeAutostart: initial.native, batchWaitState: initial.batchWaitState });
    assert.equal(disabled.responseStatus, 200);
    assert.equal(disabled.native, 'docker-present 30\n');
    const enabled = explicitOrderFixture('start-toggle', { plan, container: 'docker-extra', enabled: '1',
        nativeAutostart: disabled.native, batchWaitState: disabled.batchWaitState });
    assert.equal(enabled.responseStatus, 200);
    assert.equal(enabled.native, 'docker-present 7\ndocker-extra 30\n');
    const synced = explicitOrderFixture('start-sync', { plan, nativeAutostart: enabled.native, batchWaitState: enabled.batchWaitState });
    assert.equal(synced.response.syncOutcome, 'synced');
    assert.equal(synced.native, enabled.native);
    assert.deepEqual(synced.batchWaitState, enabled.batchWaitState);
});

test('batch reorder and zero delay restore native waits and preserve independent changes', () => {
    const batch = { id: 'batch', delay: 29, items: ['docker-present', 'docker-extra'].map(name => ({ type: 'container', name })) };
    const plan = { mode: 'custom-batches', batches: [batch] };
    const initial = explicitOrderFixture('start-sync', { plan, nativeAutostart: 'docker-present 7\ndocker-extra 19\n' });
    assert.equal(initial.native, 'docker-present 7\ndocker-extra 29\n');
    const reshuffled = { ...batch, items: [...batch.items].reverse() };
    for (const [nativeAutostart, expected] of [[initial.native, 19], [initial.native.replace('29', '7200 external'), '7200 external']]) {
        const reordered = explicitOrderFixture('start-save', { plan, nativeAutostart, batchWaitState: initial.batchWaitState,
            planPatch: { batches: [reshuffled] } });
        assert.equal(reordered.response.dockerOrderSync, 'synced');
        assert.equal(reordered.native, `docker-extra ${expected}\ndocker-present 29\n`);
        const removed = explicitOrderFixture('start-save', { plan: { ...plan, batches: [reshuffled] },
            nativeAutostart: reordered.native, batchWaitState: reordered.batchWaitState,
            planPatch: { batches: [{ ...reshuffled, delay: 0 }] } });
        assert.equal(removed.response.dockerOrderSync, 'synced');
        assert.equal(removed.native, `docker-extra ${expected}\ndocker-present 7\n`);
        assert.deepEqual(removed.batchWaitState.active, []);
    }
});

test('an interrupted batch ownership update is applied only when the proposed native bytes were committed', () => {
    const nativeAutostart = 'docker-present 7\ndocker-extra 29\n';
    const ownership = { 'docker-extra': { applied: 'docker-extra 29', original: 'docker-extra 19' } };
    const pending = { digest: createHash('sha256').update(nativeAutostart).digest('hex'), ownership };
    for (const [content, expected] of [[nativeAutostart, 'docker-present 7\ndocker-extra 19\n'],
        [nativeAutostart.replace('29', '88'), 'docker-present 7\ndocker-extra 88\n']]) {
        const reconciled = explicitOrderFixture('start-sync', { plan: { mode: 'docker-page' },
            nativeAutostart: content, batchWaitState: { active: [], pending } });
        assert.equal(reconciled.response.syncOutcome, 'synced');
        assert.equal(reconciled.native, expected);
    }
});

test('a sparse wait patch preserves a newer peer value even when PHP decodes names as array keys', () => {
    const docker = ['0', '1'].map((name, index) => ({
        Id: String(index + 1).repeat(64), Names: [`/${name}`], Image: 'fixture/image:latest', State: 'exited'
    }));
    const result = explicitOrderFixture('start-save', {
        docker, nativeAutostart: '0 7\n1 55\n', plan: { mode: 'docker-page', containerWaits: { '0': 7, '1': 55 } },
        planPatch: { containerWaits: { '0': 0 } }
    });
    assert.equal(result.responseStatus, 200);
    assert.equal(result.response.dockerOrderSync, 'synced');
    assert.deepEqual(Array.from(Object.values(result.response.prefs.dockerStartOrder.containerWaits)), [0, 55]);
    assert.equal(result.waitMapIsObject, true);
    assert.equal(result.native, '0\n1 55\n');
});

test('an order-only write settles interrupted wait ownership before the next edit', () => {
    const proposed = 'docker-present 7\ndocker-extra 29\n';
    const ownership = { 'docker-extra': { applied: 'docker-extra 29', original: 'docker-extra 19' } };
    const batchWaitState = { active: [], pending: { digest: createHash('sha256').update(proposed).digest('hex'), ownership } };
    const batch = { id: 'fixture', delay: 29, items: [{ type: 'container', name: 'docker-extra' }] };
    const plan = { mode: 'custom-batches', remaining: 'before', batches: [batch] };
    for (const wait of [7, 11]) {
        const nativeAutostart = proposed.replace('present 7', `present ${wait}`);
        const reordered = explicitOrderFixture('start-save', { plan, planPatch: { remaining: 'after' }, nativeAutostart, batchWaitState });
        assert.equal(reordered.response.dockerOrderSync, 'synced');
        assert.deepEqual(reordered.batchWaitState, { active: ownership });
        assert.equal(reordered.native, `docker-extra 29\ndocker-present ${wait}\n`);
        const removed = explicitOrderFixture('start-save', {
            plan: { ...plan, remaining: 'after' }, planPatch: { batches: [{ ...batch, delay: 0 }] },
            nativeAutostart: reordered.native, batchWaitState: reordered.batchWaitState
        });
        assert.equal(removed.response.dockerOrderSync, 'synced');
        assert.equal(removed.native, `docker-extra 19\ndocker-present ${wait}\n`);
    }
});

test('Startup batch operations preserve disjoint fields, keep intended order and reject stale edits', () => {
    const first = { id: 'a', name: 'Confirmed A', delay: 5, items: [{ type: 'container', name: 'docker-present' }] };
    const second = { id: 'b', name: 'Confirmed B', delay: 8 };
    const plan = { mode: 'custom-batches', batches: [first, second] };
    const edit = { action: 'set', id: 'b', field: 'delay', previous: 8, value: 24 };
    const added = { id: 'c', name: 'Added batch' };
    const result = explicitOrderFixture('start-save', { plan, planPatch: { batchChanges: [
        edit, { action: 'add', id: 'c', value: added }, { action: 'move', id: 'c', offset: -1, neighbor: 'b' },
        { action: 'remove', id: 'a' }
    ] } });
    assert.equal(result.responseStatus, 200);
    assert.deepEqual(result.response.prefs.dockerStartOrder.batches.map(({ id, name, delay }) => [id, name, delay]), [
        ['c', 'Added batch', 0], ['b', 'Confirmed B', 24]
    ]);
    assert.equal(Object.hasOwn(result.response.prefs.dockerStartOrder, 'batchChanges'), false);
    const stale = explicitOrderFixture('start-save', { plan: { ...plan, batches: [first, { ...second, delay: 12 }] }, planPatch: { batchChanges: [edit] } });
    assert.equal(stale.responseStatus, 400);
    assert.equal(stale.native, stale.nativeBefore);
    const invalid = explicitOrderFixture('start-save', { plan, planPatch: { batchChanges: [{ ...edit, value: [] }] } });
    assert.equal(invalid.responseStatus, 400);
    assert.equal(invalid.native, invalid.nativeBefore);
});

test('Startup preview reports typed descriptions while preserving plain warning compatibility', () => {
    const result = explicitOrderFixture('preview', { nativeAutostart: 'docker-present 7\n', plan: {
        mode: 'custom-batches', batches: [{ id: 'fixture', items: [
            { type: 'folder', id: 'missing' },
            { type: 'container', name: 'missing-app' },
            { type: 'container', name: 'docker-extra' }
        ] }]
    } });
    assert.equal(result.responseStatus, 200);
    assert.deepEqual(result.response.preview.warningDetails, [
        ['missing-folder', 'folder-missing'], ['missing-container', 'missing-app'], ['autostart-off', 'docker-extra']
    ]);
    assert.deepEqual(result.response.preview.warnings, [
        'Folder in start plan no longer exists: folder-missing',
        'Container in start plan no longer exists: missing-app',
        'docker-extra is in the start plan but Docker autostart is off.'
    ]);
});

test('Startup keeps disjoint fields and declines a conflicting structural sequence as a unit', () => {
    const plan = { mode: 'unmanaged', batches: [{ id: 'a', name: 'Peer rename', delay: 5 }, { id: 'b', name: 'Beta', delay: 8 }] };
    const result = explicitOrderFixture('start-save', { plan, planPatch: { mode: 'custom-batches', batchChanges: [
        { action: 'add', id: 'c', value: { id: 'c', name: 'New' } },
        { action: 'move', id: 'c', offset: -1, neighbor: 'a' },
        { action: 'set', id: 'a', field: 'name', previous: 'Old', value: 'Mine' },
        { action: 'set', id: 'a', field: 'delay', previous: 5, value: 10 },
        { action: 'set', id: 'b', field: 'delay', previous: 8, value: 9 }
    ] } });
    assert.equal(result.responseStatus, 200);
    assert.equal(result.response.startupBatchConflicts, 3);
    assert.equal(result.response.prefs.dockerStartOrder.mode, 'unmanaged');
    assert.deepEqual(result.response.prefs.dockerStartOrder.batches.map(({ id, name, delay }) => [id, name, delay]), [
        ['a', 'Peer rename', 10], ['b', 'Beta', 9]
    ]);
    const unrelated = explicitOrderFixture('start-save', {
        plan: { mode: 'unmanaged', batches: ['a', 'b', 'c', 'd'].map(id => ({ id, name: id })) },
        planPatch: { batchChanges: [
            { action: 'move', id: 'c', offset: -1, neighbor: 'a' },
            { action: 'remove', id: 'd' }
        ] }
    });
    assert.equal(unrelated.responseStatus, 200);
    assert.equal(unrelated.response.startupBatchConflicts, 1);
    assert.deepEqual(unrelated.response.prefs.dockerStartOrder.batches.map(batch => batch.id), ['a', 'b', 'c']);
});

test('Startup reconciles multibyte queued names and repairs duplicate persisted identities', () => {
    const name = '界'.repeat(30);
    const longId = '界'.repeat(21);
    const plan = { mode: 'unmanaged', batches: [
        { id: longId + 'aA', name: 'First' }, { id: longId + 'aB', name: 'Second' },
        { id: 'batch-1', name: 'Keep existing id' }, { name: 'Previous anonymous batch' }
    ] };
    const result = explicitOrderFixture('start-save', { plan, planPatch: { batchChanges: [
        { action: 'set', id: 'batch-2', field: 'name', previous: 'Second', value: name },
        { action: 'set', id: 'batch-2', field: 'name', previous: name, value: 'Final' }
    ] } });
    assert.equal(result.responseStatus, 200);
    assert.deepEqual(result.response.prefs.dockerStartOrder.batches.map(({ id, name: label }) => [id, label]), [
        [longId + 'a', 'First'], ['batch-2', 'Final'], ['batch-1', 'Keep existing id'], ['batch-3', 'Previous anonymous batch']
    ]);
});

test('Docker startup preview and sync preserve native waits above the plugin limit', () => {
    for (const wait of [3600, 3601, 7200]) {
        const nativeAutostart = `docker-present ${wait}\n`;
        for (const mode of ['unmanaged', 'docker-page']) {
            const options = { nativeAutostart, plan: { mode } };
            const preview = explicitOrderFixture('preview', options);
            assert.equal(preview.response?.preview?.sequence[0]?.wait, wait);
            assert.equal(preview.response?.preview?.sequence[0]?.waitSource, 'native');
            const sync = explicitOrderFixture('start-sync', options);
            assert.equal(sync.response?.syncOutcome, mode === 'unmanaged' ? 'unmanaged' : 'synced');
            assert.equal(sync.native, nativeAutostart);
        }
    }
    const override = explicitOrderFixture('start-sync', {
        nativeAutostart: 'docker-present 7200\n', plan: { mode: 'docker-page', containerWaits: { 'docker-present': 0 } }
    });
    assert.equal(override.response?.syncOutcome, 'synced');
    assert.equal(override.native, 'docker-present\n');
    const nativeWithSuffix = 'docker-present 7200 trailing-token\n';
    const nativeSuffixPreview = explicitOrderFixture('preview', { nativeAutostart: nativeWithSuffix });
    assert.equal(nativeSuffixPreview.response?.preview?.sequence[0]?.wait, 7200);
    const nativeSuffixSync = explicitOrderFixture('start-sync', { nativeAutostart: nativeWithSuffix });
    assert.equal(nativeSuffixSync.native, nativeWithSuffix);
});

test('a startup preference commit reports native sync failure and remains available for retry', () => {
    const nativeAutostart = 'docker-present 7\n';
    const planPatch = { containerWaits: { 'docker-present': 73 } };
    for (const [syncLock, outcome] of [['blocked', 'failed'], ['held', 'queued'], ['', 'synced']]) {
        const result = explicitOrderFixture('start-save', { nativeAutostart, planPatch, syncLock });
        assert.equal(result.responseStatus, 200, syncLock);
        assert.equal(result.response?.configChanged, true, syncLock);
        assert.equal(result.response?.prefs?.dockerStartOrder?.containerWaits?.['docker-present'], 73);
        assert.equal(result.response?.dockerOrderSync, outcome, syncLock);
        assert.equal(result.native, outcome === 'synced' ? 'docker-present 73\n' : nativeAutostart);
    }
    const retry = explicitOrderFixture('start-sync', { nativeAutostart, plan: { mode: 'docker-page', ...planPatch } });
    assert.equal(retry.response?.syncOutcome, 'synced');
    assert.equal(retry.native, 'docker-present 73\n');
});

const assertOrderSyncRefused = (result, code, label) => {
    assert.equal(result.error, '', label);
    assert.equal(result.native, result.nativeBefore, label);
    assert.equal(result.nativeMode, result.nativeModeBefore, label);
    assert.equal(result.response?.ok, false, label);
    assert.equal(result.response?.syncOutcome, 'failed', label);
    assert.equal(result.response?.errorCode, code, label);
    assert.equal(result.responseStatus, code === 'docker_order_lock_unavailable' ? 503 : 409, label);
    assert.doesNotMatch(JSON.stringify(result.response), /fvplus-inventory-|docker-sync-order\.lock/);
};

for (const operation of explicitOrderRequests) {
    test(`${operation} refuses synchronization when the Docker order lock cannot be opened`, () => {
        const result = explicitOrderFixture(operation, { syncLock: 'blocked' });
        assertOrderSyncRefused(result, 'docker_order_lock_unavailable', operation);
    });

    test(`${operation} coalesces an occupied lock without touching native records`, () => {
        const result = explicitOrderFixture(operation, { syncLock: 'held' });
        assert.equal(result.error, '');
        assert.equal(result.response?.ok, true);
        assert.equal(result.response?.syncOutcome, 'queued');
        assert.equal(result.responseStatus, 200);
        assert.equal(result.native, result.nativeBefore);
        assert.equal(result.nativeMode, result.nativeModeBefore);
        assert.equal(result.syncPending, true);
    });

    for (const folderPrimary of ['corrupt', 'missing', 'scalar', 'invalid-folder', 'invalid-members']) {
        test(`${operation} uses verified last-good membership and waits when the primary is ${folderPrimary}`, () => {
            const result = explicitOrderFixture(operation, { folderPrimary });
            assert.equal(result.error, '');
            assert.equal(result.response?.ok, true);
            assert.equal(result.response?.syncOutcome, 'synced');
            assert.equal(result.responseStatus, 200);
            assert.equal(result.native, 'docker-present 7\ndocker-extra 19\n');
        });

    }

    for (const [folderPrimary, folderLastGood] of [
        ['corrupt', 'corrupt'], ['corrupt', 'missing'], ['missing', 'corrupt'], ['missing', 'missing'],
        ['scalar', 'invalid-folder'], ['invalid-folder', 'scalar'], ['invalid-members', 'invalid-members']
    ]) {
        test(`${operation} refuses folder maps when the primary is ${folderPrimary} and last-good is ${folderLastGood}`, () => {
            const result = explicitOrderFixture(operation, { folderPrimary, folderLastGood });
            assertOrderSyncRefused(result, 'docker_order_folders_unavailable', `${folderPrimary}/${folderLastGood}`);
        });
    }
}

test('managed sync accepts the canonical empty folder map without reviving old memberships', () => {
    const result = explicitOrderFixture('sync', { folderPrimary: 'empty' });
    assert.equal(result.error, '');
    assert.equal(result.response?.ok, true);
    assert.equal(result.native, 'docker-extra 19\ndocker-present 7\n');
});

test('post-save synchronization declines unsafe order writes without throwing', () => {
    for (const options of [
        { syncLock: 'blocked' },
        { folderPrimary: 'missing', folderLastGood: 'corrupt' }
    ]) {
        const result = explicitOrderFixture('sync-hook', options);
        assert.equal(result.error, '');
        assert.equal(result.native, result.nativeBefore);
        assert.equal(result.nativeMode, result.nativeModeBefore);
    }
});

test('skipped synchronization reports its outcome without returning a misleading preview', () => {
    for (const [options, outcome] of [
        [{ plan: { mode: 'unmanaged' } }, 'unmanaged'],
        [{ scenario: 'failed-list' }, 'failed'],
        [{ syncLock: 'held' }, 'queued']
    ]) {
        const request = { ...options, folderPrimary: 'missing', folderLastGood: 'corrupt' };
        const sync = explicitOrderFixture('sync', request);
        const startSync = explicitOrderFixture('start-sync', request);
        assert.equal(sync.response?.ok, true);
        assert.equal(sync.responseStatus, 200);
        assert.equal(sync.response?.syncOutcome, outcome);
        assert.equal(startSync.response?.ok, outcome !== 'failed');
        assert.equal(startSync.responseStatus, outcome === 'failed' ? 409 : 200);
        assert.equal(startSync.response?.syncOutcome, outcome);
        assert.equal(startSync.response?.preview, undefined);
        for (const result of [sync, startSync]) {
            assert.equal(result.error, '');
            assert.equal(result.native, result.nativeBefore);
            assert.equal(result.nativeMode, result.nativeModeBefore);
        }
    }
});

test('Settings sync refuses unverifiable inventory even when its read-only preview would succeed', () => {
    const options = { rejectVerifiedInventory: true };
    const preview = explicitOrderFixture('preview', options);
    assert.equal(preview.response?.ok, true);
    assert.ok(Array.isArray(preview.response.preview.order));
    const sync = explicitOrderFixture('start-sync', options);
    assertOrderSyncRefused(sync, 'docker_order_inventory_unavailable', 'verified source rejected');
    assert.equal(sync.response.preview, undefined);
});

test('Diagnostics distinguishes a queued order repair from a completed one', () => {
    const sync = explicitOrderFixture('diagnostics-sync', { syncLock: 'held' });
    assert.equal(sync.error, '');
    assert.equal(sync.response?.ok, true);
    assert.equal(sync.response?.syncOutcome, 'queued');
    assert.equal(sync.response?.messageKey, 'common.server.folderview-plus-configuration-is-busy-please-retry-the-action-260891');
    assert.equal(sync.native, sync.nativeBefore);
});

test('an autostart write failure preserves native order and reports a failed sync', () => {
    const options = { failNativeWrite: true };
    const explicit = explicitOrderFixture('start-sync', options);
    assertOrderSyncRefused(explicit, 'docker_order_native_write_failed', 'native write failure');
    const postSave = explicitOrderFixture('sync', options);
    assert.equal(postSave.error, '');
    assert.equal(postSave.responseStatus, 200);
    assert.equal(postSave.response.ok, true);
    assert.equal(postSave.response.syncOutcome, 'failed');
    assert.equal(postSave.response.errorCode, 'docker_order_native_write_failed');
    assert.equal(postSave.native, postSave.nativeBefore);
    assert.equal(postSave.nativeMode, postSave.nativeModeBefore);
});

test('a guarded folder batch stays saved and reports unsynced native order after a write failure', () => {
    const batch = explicitOrderFixture('batch', { failNativeWrite: true });
    assert.equal(batch.error, '');
    assert.equal(batch.responseStatus, 200);
    assert.equal(batch.response?.ok, true);
    const result = batch.response.result;
    assert.equal(result.dockerOrderSynced, false);
    assert.equal(result.createdIds.length, 1);
    assert.equal(batch.folders[result.createdIds[0]].name, 'Persisted while native unavailable');
    assert.equal(result.metadata.folderRevision, batch.metadata.folderRevision);
    assert.equal(batch.native, batch.nativeBefore);
});

test('post-save sync preserves native records and returns its outcome for unusable inventory', () => {
    for (const scenario of ['failed-list', 'disabled', 'http-error', 'malformed-body', 'missing-body', 'malformed-list', 'duplicate']) {
        const result = runInventoryRepair({ type: 'docker', operation: 'sync', scenario });
        assert.equal(result.error, '');
        assert.equal(result.response.ok, true);
        assert.equal(result.response.syncOutcome, 'failed', scenario);
        assert.equal(result.response.errorCode, 'docker_order_inventory_unavailable', scenario);
        assert.equal(result.native, result.nativeBefore, scenario);
    }
    const result = runInventoryRepair({ type: 'docker', operation: 'sync', scenario: 'healthy', plan: { mode: 'unmanaged' } });
    assert.equal(result.error, '');
    assert.equal(result.response.syncOutcome, 'unmanaged');
    assert.equal(result.native, result.nativeBefore);
    assert.deepEqual(result.calls, [], 'unmanaged sync must skip before runtime discovery');
});

test('explicit sync may clean a confirmed empty service without treating failed reads as empty', () => {
    const result = runInventoryRepair({ type: 'docker', operation: 'sync', scenario: 'empty' });
    assert.equal(result.error, '');
    assert.equal(result.native, '');
});

test('explicit custom batches retain configured sequencing and batch/container wait precedence', () => {
    const result = runInventoryRepair({ type: 'docker', operation: 'sync', scenario: 'healthy',
        plan: { mode: 'custom-batches', remaining: 'after', containerWaits: { 'docker-extra': 23 },
            batches: [{ id: 'fixture-batch', name: 'Batch', items: [{ type: 'container', name: 'docker-present' }], delay: 11 }] } });
    assert.equal(result.error, '');
    assert.equal(result.response.ok, true);
    assert.equal(result.native, 'docker-present 11\ndocker-extra 23\n');
});

test('an independent native writer changing waits during sync planning is not overwritten', () => {
    const result = runInventoryRepair({ type: 'docker', operation: 'sync-race', scenario: 'healthy', hostChange: true });
    assert.equal(result.error, '');
    assert.equal(result.hostWritten, 'docker-extra 88\ndocker-present 99\n');
    assert.equal(result.native, result.hostWritten);
    assert.equal(result.response.syncOutcome, 'failed');
    assert.equal(result.response.errorCode, 'docker_order_native_changed');
});
