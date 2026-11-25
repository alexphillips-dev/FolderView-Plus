import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const repoRoot = path.resolve(process.cwd());
const modulePath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.prefs-store.js'
);
const moduleSource = fs.readFileSync(modulePath, 'utf8');
const wait = (ms = 15) => new Promise((resolve) => setTimeout(resolve, ms));

const loadModule = () => {
    const context = {
        globalThis: {},
        module: { exports: {} },
        require: createRequire(modulePath),
        exports: {},
        console,
        setTimeout,
        clearTimeout,
        Date,
        Math,
        JSON,
        Object,
        Array,
        Map,
        Set,
        Promise,
        String,
        Number,
        Error
    };
    vm.createContext(context);
    new vm.Script(moduleSource, { filename: modulePath }).runInContext(context);
    return context.module.exports;
};

const createStorage = (initial = {}) => {
    const records = new Map(Object.entries(initial));
    return {
        get length() { return records.size; },
        key: index => Array.from(records.keys())[index] ?? null,
        getItem: (key) => records.has(key) ? records.get(key) : null,
        setItem: (key, value) => records.set(key, String(value)),
        removeItem: (key) => records.delete(key),
        snapshot: () => Object.fromEntries(records)
    };
};

const normalizePrefs = (prefs = {}) => ({
    ...prefs,
    dashboard: { names: true, ports: true, ...(prefs.dashboard || {}) },
    _metadata: { prefsRevision: 0, ...(prefs._metadata || {}) }
});

const outboxRecord = (sourceId, expectedRevision, patch) => JSON.stringify({
    schemaVersion: 2,
    sourceId,
    updatedAt: '2026-07-15T12:00:00.000Z',
    patch,
    operation: { patch, expectedRevision, mutationId: `${sourceId}-1` }
});

test('runtime expansion retry acknowledges its session draft before a newer peer edit and reload', async () => {
    const stateObservers = createRequire(modulePath)('./folder.runtime.state-observers.js');
    for (const durableOutbox of [true, false]) {
        const api = loadModule(), timers = new Map(), storage = createStorage(), session = createStorage();
        const folders = { folder: { settings: {} } };
        let nextTimer = 0, writes = 0;
        let disk = normalizePrefs({ expandedFolderState: { folder: false }, _metadata: { prefsRevision: 1 } });
        if (!durableOutbox) storage.setItem = () => { throw new Error('Storage quota denied'); };
        const setTimeout = (handler, delay) => { const id = ++nextTimer; timers.set(id, { handler, delay }); return id; };
        const clearTimeout = id => timers.delete(id);
        const drain = async () => {
            while (timers.size) {
                const [id, timer] = Array.from(timers).sort((a, b) => a[1].delay - b[1].delay)[0];
                timers.delete(id); timer.handler();
                for (let index = 0; index < 12; index++) await Promise.resolve();
                if (writes === 1) break;
            }
        };
        const freshCoordinator = () => api.createPreferenceSaveCoordinator({
            normalizePrefs, storage, setTimeout, clearTimeout,
            fetchPrefs: async () => disk,
            writePrefs: async (_type, patch) => {
                if (++writes === 1) throw Object.assign(new Error('Unavailable'), { status: 503 });
                disk = normalizePrefs({ ...disk, expandedFolderState: { ...disk.expandedFolderState, ...patch.expandedFolderState },
                    _metadata: { prefsRevision: disk._metadata.prefsRevision + 1 } });
                return disk;
            }
        });
        const createController = coordinator => {
            let current = { ...disk.expandedFolderState };
            return stateObservers.createExpandedStateController({ type: 'vm', storageKey: 'expansion',
                window: { setTimeout, clearTimeout, localStorage: storage, sessionStorage: session },
                normalizePrefs, preferenceCoordinator: coordinator, readPrefs: () => disk,
                readServerMap: () => current, writeServerMap: map => { current = map; }
            });
        };
        const controller = createController(freshCoordinator());
        controller.buildStateMap(folders, {}, disk.expandedFolderState);
        controller.persistStateMap({ folder: true });
        assert.deepEqual(JSON.parse(session.getItem('expansion.pending')), { folder: true });
        await drain();
        assert.equal(writes, 1);
        assert.equal(session.getItem('expansion.pending'), durableOutbox ? null : '{"folder":true}');
        await drain(); // Fire the autonomous retry timer, then its queued write.
        await drain();
        assert.equal(writes, 2);
        assert.equal(disk.expandedFolderState.folder, true);
        assert.equal(session.getItem('expansion.pending'), null);

        disk = normalizePrefs({ expandedFolderState: { folder: false }, _metadata: { prefsRevision: 3 } });
        const reopened = createController(freshCoordinator());
        assert.deepEqual(reopened.buildStateMap(folders, {}, disk.expandedFolderState), { folder: false });
        await drain();
        assert.equal(writes, 2);
        assert.equal(disk.expandedFolderState.folder, false);
    }
});

test('preference coordinator applies immediately, coalesces rapid patches, and serializes writes', async () => {
    const api = loadModule();
    const writes = [];
    let activeWrites = 0;
    let maxActiveWrites = 0;
    let revision = 1;
    const coordinator = api.createPreferenceSaveCoordinator({
        normalizePrefs,
        storage: createStorage(),
        debounceMs: 5,
        fetchPrefs: async () => normalizePrefs({ _metadata: { prefsRevision: revision } }),
        writePrefs: async (_type, patch, context) => {
            activeWrites += 1;
            maxActiveWrites = Math.max(maxActiveWrites, activeWrites);
            writes.push({ patch, context });
            await wait(8);
            activeWrites -= 1;
            revision += 1;
            return {
                ok: true,
                prefs: normalizePrefs(api.mergePatch({ dashboard: { names: true, ports: true } }, patch)),
                metadata: { prefsRevision: revision }
            };
        }
    });
    coordinator.reconcile('docker', normalizePrefs({ _metadata: { prefsRevision: 1 } }));

    const first = coordinator.save('docker', { dashboard: { names: false } });
    const second = coordinator.save('docker', { dashboard: { ports: false } });
    assert.equal(coordinator.getOptimisticPrefs('docker').dashboard.names, false);
    assert.equal(coordinator.getOptimisticPrefs('docker').dashboard.ports, false);
    await Promise.all([first, second]);

    assert.equal(writes.length, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(writes[0].patch)), {
        dashboard: { names: false, ports: false }
    });
    assert.equal(writes[0].context.expectedRevision, 1);
    assert.equal(maxActiveWrites, 1);
    assert.equal(coordinator.getDiagnostics().types.docker.coalescedMutations, 1);
});

test('preference coordinator preserves newer edits made during an in-flight request', async () => {
    const api = loadModule();
    const writes = [];
    let releaseFirst;
    const firstGate = new Promise((resolve) => { releaseFirst = resolve; });
    let revision = 4;
    const coordinator = api.createPreferenceSaveCoordinator({
        normalizePrefs,
        storage: createStorage(),
        debounceMs: 0,
        writePrefs: async (_type, patch) => {
            writes.push(patch);
            if (writes.length === 1) {
                await firstGate;
            }
            revision += 1;
            return {
                ok: true,
                prefs: normalizePrefs(api.mergePatch({ dashboard: {} }, patch)),
                metadata: { prefsRevision: revision }
            };
        }
    });
    coordinator.reconcile('docker', normalizePrefs({ _metadata: { prefsRevision: revision } }));
    const first = coordinator.save('docker', { dashboard: { names: false } }, { immediate: true });
    await wait(5);
    const second = coordinator.save('docker', { dashboard: { names: true, ports: false } }, { immediate: true });
    releaseFirst();
    await Promise.all([first, second]);

    assert.equal(writes.length, 2);
    assert.equal(coordinator.getOptimisticPrefs('docker').dashboard.names, true);
    assert.equal(coordinator.getOptimisticPrefs('docker').dashboard.ports, false);
});

test('preference coordinator restores a durable outbox after reload', async () => {
    const api = loadModule();
    const storage = createStorage({
        'fvplus.prefs.outbox.v1.docker': outboxRecord('closed-tab', 7, { dashboard: { ports: false } })
    });
    const writes = [];
    const coordinator = api.createPreferenceSaveCoordinator({
        normalizePrefs,
        storage,
        debounceMs: 0,
        fetchPrefs: async () => ({
            prefs: { dashboard: { names: true, ports: true } },
            metadata: { prefsRevision: 7 }
        }),
        writePrefs: async (_type, patch, context) => {
            writes.push({ patch, context });
            return {
                ok: true,
                prefs: api.mergePatch({ dashboard: { names: true, ports: true } }, patch),
                metadata: { prefsRevision: 8 }
            };
        }
    });

    const hydrated = await coordinator.hydrateFromServer('docker');
    assert.equal(hydrated.dashboard.ports, false);
    await wait(20);
    assert.equal(writes.length, 1);
    assert.deepEqual(structuredClone(writes[0].context), { expectedRevision: 7, clientMutationId: 'closed-tab-1' });
    assert.equal(storage.getItem('fvplus.prefs.outbox.v1.docker'), null);
});

test('preference coordinator replays a restored outbox after raw runtime reconciliation', async () => {
    const api = loadModule();
    const storage = createStorage({
        'fvplus.prefs.outbox.v1.docker': outboxRecord('settings-page', 9, { dashboard: { privacyMaskNames: false } })
    });
    const writes = [];
    const coordinator = api.createPreferenceSaveCoordinator({
        normalizePrefs,
        storage,
        debounceMs: 0,
        writePrefs: async (_type, patch) => {
            writes.push(patch);
            return {
                ok: true,
                prefs: api.mergePatch({ dashboard: { privacyMaskNames: true } }, patch),
                metadata: { prefsRevision: 10 }
            };
        }
    });

    const reconciled = coordinator.reconcile('docker', {
        dashboard: { privacyMaskNames: true },
        _metadata: { prefsRevision: 9 }
    });
    assert.equal(reconciled.dashboard.privacyMaskNames, false);
    await wait(20);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].dashboard.privacyMaskNames, false);
    assert.equal(storage.getItem('fvplus.prefs.outbox.v1.docker'), null);
});

test('preference coordinator rebases and retries a revision conflict without rolling back UI', async () => {
    const api = loadModule();
    let writeCount = 0;
    const revisions = [];
    const coordinator = api.createPreferenceSaveCoordinator({
        normalizePrefs,
        storage: createStorage(),
        debounceMs: 0,
        fetchPrefs: async () => ({
            prefs: { dashboard: { names: true, ports: true } },
            metadata: { prefsRevision: 12 }
        }),
        writePrefs: async (_type, patch, context) => {
            writeCount += 1;
            revisions.push(context.expectedRevision);
            if (writeCount === 1) {
                const error = new Error('Conflict');
                error.status = 409;
                throw error;
            }
            return {
                ok: true,
                prefs: api.mergePatch({ dashboard: { names: true, ports: true } }, patch),
                metadata: { prefsRevision: 13 }
            };
        }
    });
    coordinator.reconcile('docker', normalizePrefs({ _metadata: { prefsRevision: 11 } }));
    const saved = coordinator.save('docker', { dashboard: { names: false } }, { immediate: true });
    await wait(8);
    assert.equal(coordinator.getOptimisticPrefs('docker').dashboard.names, false);
    await saved;

    assert.deepEqual(revisions, [11, 12]);
    assert.equal(coordinator.getDiagnostics().types.docker.conflicts, 1);
    assert.equal(coordinator.getDiagnostics().types.docker.status, 'saved');
});

test('concurrent rule saves preserve committed rules and still rebase over unrelated preferences', async () => {
    const api = loadModule();
    const incoming = [{ id: 'rule-from-this-tab' }];
    const otherRule = [{ id: 'rule-from-another-tab' }];
    for (const sameField of [true, false]) {
        let releaseWrite;
        let resolveWriteStarted;
        const allowWrite = new Promise(resolve => { releaseWrite = resolve; });
        const writeStarted = new Promise(resolve => { resolveWriteStarted = resolve; });
        let stored = normalizePrefs({ autoRules: [], _metadata: { prefsRevision: 1 } });
        const writes = [];
        const storage = createStorage();
        const writer = api.createPreferenceSaveCoordinator({
            normalizePrefs, storage, debounceMs: 0,
            fetchPrefs: async () => stored,
            writePrefs: async (_type, patch, { expectedRevision }) => {
                writes.push(expectedRevision);
                if (writes.length === 1) {
                    resolveWriteStarted();
                    await allowWrite;
                }
                if (expectedRevision !== stored._metadata.prefsRevision) {
                    throw Object.assign(new Error('Revision conflict'), { status: 409 });
                }
                stored = normalizePrefs({ ...api.mergePatch(stored, patch), _metadata: { prefsRevision: expectedRevision + 1 } });
                return stored;
            }
        });
        writer.reconcile('docker', stored);
        const save = writer.save('docker', { autoRules: incoming });
        const settlement = sameField ? assert.rejects(save, /Review and save your changes again/) : save;
        await writeStarted;
        stored = normalizePrefs({
            autoRules: sameField ? otherRule : [], groupUnassignedItems: true,
            _metadata: { prefsRevision: 2 }
        });
        releaseWrite();
        await settlement;
        assert.deepEqual(writes, sameField ? [1] : [1, 2]);
        assert.deepEqual(stored.autoRules, sameField ? otherRule : incoming);
        assert.deepEqual(writer.getOptimisticPrefs('docker').autoRules, stored.autoRules);
        assert.equal(writer.getOptimisticPrefs('docker').groupUnassignedItems, true);
        assert.deepEqual(storage.snapshot(), {});
    }
});

test('folder visibility mutations rebase across tabs and a whole-list reset supersedes earlier queued changes', async () => {
    const api = loadModule();
    let stored = normalizePrefs({ hiddenFolderIds: [], _metadata: { prefsRevision: 11 } });
    const writes = [];
    const make = () => {
        const coordinator = api.createPreferenceSaveCoordinator({
            normalizePrefs, storage: createStorage(), debounceMs: 1000,
            fetchPrefs: async () => stored,
            writePrefs: async (_type, patch, { expectedRevision }) => {
                writes.push({ patch: JSON.parse(JSON.stringify(patch)), expectedRevision });
                if (expectedRevision !== stored._metadata.prefsRevision) throw Object.assign(new Error('Revision conflict'), { status: 409 });
                stored = normalizePrefs({ ...api.mergePatch(stored, patch), _metadata: { prefsRevision: expectedRevision + 1 } });
                return stored;
            }
        });
        coordinator.reconcile('docker', stored);
        return coordinator;
    };
    const first = make();
    const second = make();
    await first.save('docker', { hiddenFolderIdChanges: { one: true } }, { immediate: true });
    await second.save('docker', { hiddenFolderIdChanges: { two: true } }, { immediate: true });
    assert.deepEqual(writes.map(write => write.expectedRevision), [11, 11, 12]);
    assert.deepEqual(stored.hiddenFolderIds, ['one', 'two']);
    const pendingHide = second.save('docker', { hiddenFolderIdChanges: { three: true } });
    const reset = second.save('docker', { hiddenFolderIds: [] });
    const laterHide = second.save('docker', { hiddenFolderIdChanges: { four: true } }, { immediate: true });
    await Promise.all([pendingHide, reset, laterHide]);
    assert.deepEqual(writes.at(-1).patch, { hiddenFolderIds: [], hiddenFolderIdChanges: { four: true } });
    assert.deepEqual(stored.hiddenFolderIds, ['four']);
    assert.equal(Object.hasOwn(stored, 'hiddenFolderIdChanges'), false);
});

test('a rule save queued from an older view cannot use a newer broadcast revision', async () => {
    const api = loadModule();
    const writes = [];
    const writer = api.createPreferenceSaveCoordinator({
        normalizePrefs, debounceMs: 0,
        writePrefs: async (_type, patch) => { writes.push(patch); return patch; }
    });
    const previousView = normalizePrefs({ autoRules: [], _metadata: { prefsRevision: 1 } });
    const newRules = [{ id: 'saved-by-another-tab' }];
    writer.reconcile('docker', previousView);
    const save = assert.rejects(writer.save('docker', { autoRules: [{ id: 'local' }] }, { currentPrefs: previousView }),
        /Review and save your changes again/);
    writer.reconcile('docker', normalizePrefs({ autoRules: newRules, _metadata: { prefsRevision: 2 } }));
    await save;
    assert.deepEqual(writes, []);
    assert.deepEqual(writer.getOptimisticPrefs('docker').autoRules, newRules);
});

test('rule retries and reopened pages can acknowledge an already committed rule after hydration', async () => {
    const api = loadModule();
    for (const reopen of [false, true]) {
        const storage = createStorage();
        const rules = [{ id: 'committed-with-lost-ack' }];
        let stored = normalizePrefs({ autoRules: [], _metadata: { prefsRevision: 1 } });
        const requests = [];
        const options = {
            window: {}, normalizePrefs, storage, debounceMs: 0, retryDelayMs: 1000, fetchPrefs: async () => stored,
            setTimeout: (callback, delay) => delay >= 1000 ? null : setTimeout(callback, delay),
            writePrefs: async (_type, patch, context) => {
                requests.push(structuredClone({ patch, context }));
                if (requests.length === 1) {
                    stored = normalizePrefs({ autoRules: rules, _metadata: { prefsRevision: 2 } });
                    throw Object.assign(new Error('Response lost'), { status: 503 });
                }
                assert.deepEqual(requests[1], requests[0], 'retry must reach the server receipt with its original revision and mutation ID');
                return { prefs: stored };
            }
        };
        const origin = api.createPreferenceSaveCoordinator({ ...options, sourceId: 'origin' });
        origin.reconcile('vm', stored);
        await assert.rejects(origin.save('vm', { autoRules: rules }), /Response lost/);
        const receiver = reopen ? api.createPreferenceSaveCoordinator({ ...options, sourceId: 'reopened' }) : origin;
        await receiver.hydrateFromServer('vm');
        await receiver.flush('vm');
        assert.equal(requests.length, 2);
        assert.equal(receiver.getSnapshot('vm').status, 'saved');
        assert.deepEqual(receiver.getOptimisticPrefs('vm').autoRules, rules);
        assert.deepEqual(storage.snapshot(), {});
    }
});

test('preference coordinator broadcasts committed revisions to another tab', async () => {
    const api = loadModule();
    const channels = [];
    class FakeBroadcastChannel {
        constructor(name) {
            this.name = name;
            this.listeners = [];
            channels.push(this);
        }
        addEventListener(kind, listener) {
            if (kind === 'message') {
                this.listeners.push(listener);
            }
        }
        postMessage(data) {
            channels
                .filter((channel) => channel !== this && channel.name === this.name)
                .forEach((channel) => channel.listeners.forEach((listener) => listener({ data })));
        }
    }
    const common = {
        normalizePrefs,
        debounceMs: 0,
        BroadcastChannel: FakeBroadcastChannel,
        storage: createStorage()
    };
    const firstTab = api.createPreferenceSaveCoordinator({
        ...common,
        sourceId: 'first-tab',
        writePrefs: async (_type, patch) => ({
            ok: true,
            prefs: api.mergePatch({ dashboard: { names: true, ports: true } }, patch),
            metadata: { prefsRevision: 2 }
        })
    });
    const secondTab = api.createPreferenceSaveCoordinator({
        ...common,
        sourceId: 'second-tab',
        writePrefs: async () => {
            throw new Error('The receiving tab must not duplicate the write.');
        }
    });
    firstTab.reconcile('docker', normalizePrefs({ _metadata: { prefsRevision: 1 } }));
    secondTab.reconcile('docker', normalizePrefs({ _metadata: { prefsRevision: 1 } }));

    await firstTab.save('docker', { dashboard: { ports: false } }, { immediate: true });
    await wait(5);

    assert.equal(secondTab.getOptimisticPrefs('docker').dashboard.ports, false);
    assert.equal(secondTab.getSnapshot('docker').revision, 2);
    assert.equal(secondTab.getDiagnostics().types.docker.requests, 0);
});

for (const type of ['docker', 'vm']) {
    for (const responseOrder of ['first-tab-first', 'second-tab-first']) {
        test(`concurrent ${type} preference saves clear committed outboxes (${responseOrder})`, async () => {
            const api = loadModule();
            const storage = createStorage();
            let serverPrefs = normalizePrefs({ _metadata: { prefsRevision: 1 } });
            const responses = [];
            const requests = [];
            const started = [0, 1].map(() => {
                let resolve;
                const promise = new Promise(done => { resolve = done; });
                return { promise, resolve };
            });
            const common = {
                window: {}, storage, normalizePrefs, debounceMs: 0,
                fetchPrefs: async () => structuredClone(serverPrefs),
                writePrefs: async (_type, patch, context) => {
                    assert.equal(context.expectedRevision, serverPrefs._metadata.prefsRevision);
                    serverPrefs = normalizePrefs(api.mergePatch(serverPrefs, patch));
                    serverPrefs._metadata.prefsRevision += 1;
                    const committed = structuredClone(serverPrefs);
                    const index = requests.push(patch) - 1;
                    return new Promise(resolve => {
                        responses.push(() => resolve({ prefs: committed }));
                        started[index]?.resolve();
                    });
                }
            };
            const firstTab = api.createPreferenceSaveCoordinator({ ...common, sourceId: 'first-tab' });
            const secondTab = api.createPreferenceSaveCoordinator({ ...common, sourceId: 'second-tab' });
            firstTab.reconcile(type, serverPrefs);
            secondTab.reconcile(type, serverPrefs);
            const firstSave = firstTab.save(type, { dashboard: { names: false } });
            await started[0].promise;
            // The first request committed, but its response has not reached its tab.
            await secondTab.hydrateFromServer(type, { restoreOutbox: false, replay: false });
            const secondSave = secondTab.save(type, { dashboard: { ports: false } });
            await started[1].promise;
            const secondKey = Object.keys(storage.snapshot()).find(key => key.startsWith(`${secondTab.storageKeyForType(type)}.`));
            assert.ok(secondKey);
            const secondOutbox = storage.getItem(secondKey);
            if (responseOrder === 'first-tab-first') {
                responses[0]();
                await firstSave;
                assert.equal(storage.getItem(secondKey), secondOutbox, 'a completed tab preserves the pending foreign outbox and its owner');
                responses[1]();
                await secondSave;
            } else {
                responses[1]();
                await secondSave;
                responses[0]();
                await firstSave;
            }
            assert.deepEqual(storage.snapshot(), {}, 'both committed patches must leave no work to replay');
            assert.equal(firstTab.getSnapshot(type).status, 'saved');
            assert.equal(secondTab.getSnapshot(type).status, 'saved');

            // A later change on the server must survive reopening a browser tab.
            serverPrefs.dashboard.ports = true;
            serverPrefs._metadata.prefsRevision += 1;
            const reopened = api.createPreferenceSaveCoordinator({ ...common, sourceId: 'reopened-tab' });
            const hydrated = await reopened.hydrateFromServer(type);
            await reopened.flush(type);
            assert.equal(hydrated.dashboard.ports, true);
            assert.equal(requests.length, 2, 'reload must not replay already committed changes');
        });
    }
}

test('a successful tab cannot erase another tab’s still-uncommitted preferences', async () => {
    const api = loadModule();
    const storage = createStorage();
    const requests = [];
    const handlers = {};
    let started, finishFirst;
    const firstStarted = new Promise(resolve => { started = resolve; });
    let serverPrefs = normalizePrefs({ groupUnassignedItems: false, _metadata: { prefsRevision: 1 } });
    const serverWrite = async (_type, patch) => {
        requests.push(structuredClone(patch));
        serverPrefs = normalizePrefs(api.mergePatch(serverPrefs, patch));
        serverPrefs._metadata.prefsRevision += 1;
        return { prefs: serverPrefs };
    };
    const common = { window: {}, storage, normalizePrefs, debounceMs: 0, fetchPrefs: async () => serverPrefs };
    const first = api.createPreferenceSaveCoordinator({ ...common, sourceId: 'first', writePrefs: () => new Promise(resolve => {
        finishFirst = resolve;
        started();
    }) });
    const second = api.createPreferenceSaveCoordinator({
        ...common, sourceId: 'second', writePrefs: serverWrite,
        window: { addEventListener: (type, handler) => { handlers[type] = handler; } }
    });
    for (const tab of [first, second]) tab.reconcile('docker', serverPrefs);
    const pending = first.save('docker', { groupUnassignedItems: true });
    await firstStarted;
    const [firstKey] = Object.keys(storage.snapshot());
    const firstRecord = storage.getItem(firstKey);
    handlers.storage({ key: firstKey, newValue: firstRecord });
    assert.equal(second.getOptimisticPrefs('docker').groupUnassignedItems, true);
    await second.save('docker', { dashboard: { ports: false } });
    assert.deepEqual(requests, [{ dashboard: { ports: false } }], 'the second tab only submits its own edit');
    assert.equal(serverPrefs.groupUnassignedItems, false);
    assert.deepEqual(storage.snapshot(), { [firstKey]: firstRecord });

    const reloaded = api.createPreferenceSaveCoordinator({ ...common, sourceId: 'reloaded', writePrefs: serverWrite });
    await reloaded.hydrateFromServer('docker');
    await reloaded.flush('docker');
    assert.deepEqual(requests[1], { groupUnassignedItems: true });
    assert.equal(serverPrefs.groupUnassignedItems, true);
    assert.deepEqual(storage.snapshot(), {});
    finishFirst({ prefs: serverPrefs });
    await pending;
});

test('a replay acknowledgement cannot clear a newer edit owned by the originating tab', async () => {
    const api = loadModule();
    const storage = createStorage();
    const original = { _metadata: { prefsRevision: 1 }, groupUnassignedItems: false };
    let startOrigin, startReplay, finishOrigin, finishReplay;
    const originStarted = new Promise(resolve => { startOrigin = resolve; });
    const replayStarted = new Promise(resolve => { startReplay = resolve; });
    const options = { storage, window: {}, normalizePrefs, debounceMs: 0 };
    const origin = api.createPreferenceSaveCoordinator({ ...options, sourceId: 'origin', writePrefs: (_type, patch) => {
        if (patch.dashboard) return Promise.resolve({ prefs: { ...original, groupUnassignedItems: true, ...patch } });
        return new Promise(resolve => { finishOrigin = resolve; startOrigin(); });
    } });
    origin.reconcile('vm', original);
    const firstSave = origin.save('vm', { groupUnassignedItems: true });
    await originStarted;
    const [initialKey] = Object.keys(storage.snapshot());
    const replay = api.createPreferenceSaveCoordinator({ ...options, sourceId: 'replay', writePrefs: (_type, patch) => {
        assert.deepEqual(structuredClone(patch), { groupUnassignedItems: true });
        return new Promise(resolve => { finishReplay = resolve; startReplay(); });
    } });
    replay.reconcile('vm', original);
    await replayStarted;
    const secondSave = origin.save('vm', { dashboard: { ports: false } });
    const [newKey] = Object.keys(storage.snapshot());
    assert.notEqual(newKey, initialKey);
    finishReplay({ prefs: { ...original, groupUnassignedItems: true, _metadata: { prefsRevision: 2 } } });
    await replay.flush('vm');
    assert.deepEqual(JSON.parse(storage.getItem(newKey)).patch, { groupUnassignedItems: true, dashboard: { ports: false } });
    finishOrigin({ prefs: { ...original, groupUnassignedItems: true, _metadata: { prefsRevision: 2 } } });
    await Promise.all([firstSave, secondSave]);
    assert.deepEqual(storage.snapshot(), {});
});

test('a rejected recovered owner does not erase another owner or a new local save', async () => {
    const api = loadModule();
    const storage = createStorage({
        'fvplus.prefs.outbox.v1.vm': outboxRecord('first-owner', 1, { autoRules: [{ folderId: 'synthetic-missing' }] }),
        'fvplus.prefs.outbox.v1.vm.foreign.1': outboxRecord('foreign', 1, { dashboard: { names: false } })
    });
    const writes = [];
    let serverPrefs = normalizePrefs({ _metadata: { prefsRevision: 1 } });
    const coordinator = api.createPreferenceSaveCoordinator({
        window: {}, storage, normalizePrefs, debounceMs: 0,
        writePrefs: async (_type, patch) => {
            writes.push(structuredClone(patch));
            if (patch.autoRules) throw Object.assign(new Error('Missing folder'), { status: 400 });
            serverPrefs = normalizePrefs(api.mergePatch(serverPrefs, patch));
            serverPrefs._metadata.prefsRevision += 1;
            return { prefs: serverPrefs };
        }
    });
    coordinator.reconcile('vm', serverPrefs);
    await coordinator.save('vm', { groupUnassignedItems: true });
    assert.deepEqual(writes, [
        { autoRules: [{ folderId: 'synthetic-missing' }] },
        { dashboard: { names: false } },
        { groupUnassignedItems: true }
    ]);
    assert.equal(serverPrefs.dashboard.names, false);
    assert.equal(serverPrefs.groupUnassignedItems, true);
    assert.deepEqual(storage.snapshot(), {});
});

test('an outbox replay cannot overwrite newer preferences after a lost acknowledgement', async () => {
    const api = loadModule();
    const storage = createStorage();
    const writes = [];
    let stored = normalizePrefs({ sortMode: 'created', _metadata: { prefsRevision: 1 } });
    const write = (_type, patch, context) => {
        writes.push(structuredClone(context));
        if (context.expectedRevision !== stored._metadata.prefsRevision) {
            throw Object.assign(new Error('Refresh before saving again.'), { status: 409 });
        }
        stored = normalizePrefs(api.mergePatch(stored, patch));
        stored._metadata.prefsRevision = context.expectedRevision + 1;
        return { prefs: stored };
    };
    let completeFirst;
    const committed = new Promise(resolve => { completeFirst = resolve; });
    const common = { window: {}, normalizePrefs, debounceMs: 0, fetchPrefs: async () => stored };
    const first = api.createPreferenceSaveCoordinator({
        ...common, sourceId: 'first', storage,
        writePrefs: (...args) => {
            write(...args);
            completeFirst();
            return new Promise(() => {});
        }
    });
    first.reconcile('vm', stored);
    void first.save('vm', { sortMode: 'alpha' });
    await committed;
    const later = api.createPreferenceSaveCoordinator({ ...common, storage: createStorage(), sourceId: 'later', writePrefs: write });
    await later.hydrateFromServer('vm');
    await later.save('vm', { sortMode: 'manual' });
    const reopened = api.createPreferenceSaveCoordinator({ ...common, storage, sourceId: 'reopened', writePrefs: write });
    const hydrated = await reopened.hydrateFromServer('vm');
    assert.equal(hydrated.sortMode, 'manual');
    await assert.rejects(reopened.flush('vm'), /Refresh before saving/);
    assert.deepEqual(writes, [
        { expectedRevision: 1, clientMutationId: 'first-1' },
        { expectedRevision: 2, clientMutationId: 'later-1' },
        { expectedRevision: 1, clientMutationId: 'first-1' }
    ]);
    assert.equal(stored.sortMode, 'manual');
    assert.equal(stored._metadata.prefsRevision, 3);
    assert.deepEqual(storage.snapshot(), {});
});

test('legacy outbox records without a base revision cannot change current preferences', async () => {
    const api = loadModule();
    for (const suffix of ['', '.legacy.1']) {
        const notices = [];
        const storage = createStorage({
            [`fvplus.prefs.outbox.v1.vm${suffix}`]: JSON.stringify({
                schemaVersion: 1, sourceId: 'legacy', patch: { sortMode: 'alpha' }
            })
        });
        const coordinator = api.createPreferenceSaveCoordinator({
            window: { FolderViewPlusUI: { alert: notice => notices.push(notice) } }, storage, normalizePrefs, debounceMs: 0,
            writePrefs: () => assert.fail('unversioned outbox reached the server')
        });
        const confirmed = normalizePrefs({ sortMode: 'manual', _metadata: { prefsRevision: 3 } });
        assert.equal(coordinator.reconcile('vm', confirmed).sortMode, 'manual');
        await assert.rejects(coordinator.flush('vm'), /Review and save your changes again/);
        assert.equal(coordinator.getSnapshot('vm').status, 'failed');
        assert.equal(coordinator.getSnapshot('vm').recoveryConflict, true);
        assert.deepEqual(storage.snapshot(), {});
        assert.equal(notices.length, 1);
        assert.match(notices[0].message, /Review and save your changes again/);
    }
});

test('a lost preference reply preserves a newer queued edit across consecutive reloads', async () => {
    const api = loadModule();
    const storage = createStorage();
    const writes = [];
    let stored = normalizePrefs({ sortMode: 'created', _metadata: { prefsRevision: 1 } });
    let receipt = null;
    const commit = (_type, patch, context) => {
        const request = structuredClone({ patch, context });
        writes.push(request);
        if (context.expectedRevision === stored._metadata.prefsRevision) {
            stored = normalizePrefs(api.mergePatch(stored, patch));
            stored._metadata.prefsRevision = context.expectedRevision + 1;
            receipt = request;
        } else {
            assert.deepEqual(request, receipt);
            assert.equal(context.expectedRevision + 1, stored._metadata.prefsRevision);
        }
        return { prefs: stored };
    };
    let predecessorCommitted;
    const firstCommit = new Promise(resolve => { predecessorCommitted = resolve; });
    const common = { storage, window: {}, normalizePrefs, debounceMs: 0, fetchPrefs: async () => stored };
    const origin = api.createPreferenceSaveCoordinator({
        ...common, sourceId: 'origin',
        writePrefs: (...args) => { commit(...args); predecessorCommitted(); return new Promise(() => {}); }
    });
    origin.reconcile('vm', stored);
    void origin.save('vm', { sortMode: 'alpha' });
    await firstCommit;
    void origin.save('vm', { groupUnassignedItems: true });
    let successorRecovered;
    const successorPending = new Promise(resolve => { successorRecovered = resolve; });
    const interrupted = api.createPreferenceSaveCoordinator({
        ...common, sourceId: 'interrupted',
        writePrefs: (...args) => {
            if (args[1].groupUnassignedItems) {
                successorRecovered();
                return new Promise(() => {});
            }
            return commit(...args);
        }
    });
    await interrupted.hydrateFromServer('vm');
    await successorPending;
    const persisted = JSON.parse(Object.values(storage.snapshot())[0]);
    assert.deepEqual(persisted.operation.patch, { groupUnassignedItems: true });
    assert.equal(persisted.operation.expectedRevision, 2);
    assert.equal(persisted.operation.mutationId, 'origin-2');
    const reopened = api.createPreferenceSaveCoordinator({ ...common, sourceId: 'reopened', writePrefs: commit });
    await reopened.hydrateFromServer('vm');
    await reopened.flush('vm');
    assert.deepEqual(writes[0], writes[1]);
    assert.deepEqual(writes[2].context, { expectedRevision: 2, clientMutationId: 'origin-2' });
    assert.equal(stored.groupUnassignedItems, true);
    assert.equal(stored._metadata.prefsRevision, 3);
    assert.deepEqual(storage.snapshot(), {});
});

test('adopting a newer broadcast invalidates an outdated foreign optimistic patch', () => {
    const api = loadModule();
    const storage = createStorage();
    const handlers = new Map();
    class TestChannel {
        addEventListener(name, listener) { handlers.set(name, listener); }
    }
    const coordinator = api.createPreferenceSaveCoordinator({
        storage, normalizePrefs, sourceId: 'observer', BroadcastChannel: TestChannel,
        window: { addEventListener: (name, listener) => handlers.set(name, listener) }
    });
    coordinator.reconcile('vm', normalizePrefs({ sortMode: 'created', _metadata: { prefsRevision: 1 } }));
    const key = 'fvplus.prefs.outbox.v1.vm.foreign.1';
    const raw = outboxRecord('foreign', 1, { sortMode: 'alpha' });
    storage.setItem(key, raw);
    handlers.get('storage')({ key, newValue: raw });
    assert.equal(coordinator.getOptimisticPrefs('vm').sortMode, 'alpha');
    handlers.get('message')({ data: { action: 'committed', sourceId: 'newer', type: 'vm',
        prefs: normalizePrefs({ sortMode: 'manual', _metadata: { prefsRevision: 2 } }) } });
    assert.equal(coordinator.getOptimisticPrefs('vm').sortMode, 'manual');
});

test('confirmed Docker row placement excludes a queued peer edit until its server revision arrives', () => {
    const api = loadModule(), storage = createStorage(), handlers = new Map();
    const viewer = api.createPreferenceSaveCoordinator({
        normalizePrefs, storage, sourceId: 'docker-tab',
        window: { addEventListener: (name, listener) => handlers.set(name, listener) }
    });
    const editor = api.createPreferenceSaveCoordinator({
        normalizePrefs, storage, sourceId: 'settings-tab', window: {}, setTimeout: () => 1, clearTimeout: () => {}
    });
    assert.equal(viewer.getConfirmedPrefs('docker'), null);
    const initial = normalizePrefs({ dockerRowPlacement: 'folders-first', _metadata: { prefsRevision: 3 } });
    viewer.reconcile('docker', initial);
    editor.reconcile('docker', initial);
    void editor.save('docker', { dockerRowPlacement: 'saved-order' });
    const [[key, newValue]] = Object.entries(storage.snapshot());
    handlers.get('storage')({ key, newValue });
    assert.equal(viewer.getSnapshot('docker').pending, false);
    assert.equal(viewer.getOptimisticPrefs('docker').dockerRowPlacement, 'saved-order');
    assert.equal(viewer.getConfirmedPrefs('docker').dockerRowPlacement, 'folders-first');
    assert.equal(editor.getConfirmedPrefs('docker').dockerRowPlacement, 'folders-first');

    viewer.reconcile('docker', initial, { restoreOutbox: false });
    assert.equal(viewer.getSnapshot('docker').status, 'saved');
    assert.equal(viewer.getOptimisticPrefs('docker').dockerRowPlacement, 'saved-order');
    assert.equal(viewer.getConfirmedPrefs('docker').dockerRowPlacement, 'folders-first');

    viewer.reconcile('docker', normalizePrefs({ dockerRowPlacement: 'saved-order', _metadata: { prefsRevision: 4 } }));
    viewer.reconcile('docker', initial);
    assert.equal(viewer.getConfirmedPrefs('docker').dockerRowPlacement, 'saved-order');
    assert.equal(viewer.getConfirmedPrefs('docker')._metadata.prefsRevision, 4);
    assert.equal(viewer.getConfirmedPrefs('vm'), null);
});

test('a temporary storage failure retains its exact preference operation and retries it', async () => {
    const api = loadModule();
    const writes = [];
    const storage = createStorage();
    const coordinator = api.createPreferenceSaveCoordinator({
        window: {}, sourceId: 'retry', storage, normalizePrefs, debounceMs: 0, retryDelayMs: 250,
        writePrefs: async (_type, patch, context) => {
            writes.push(structuredClone({ patch, context }));
            if (writes.length === 1) throw Object.assign(new Error('Request failed.'), { status: 503 });
            return { prefs: normalizePrefs({ ...patch, _metadata: { prefsRevision: 2 } }) };
        }
    });
    coordinator.reconcile('vm', normalizePrefs({ groupUnassignedItems: false, _metadata: { prefsRevision: 1 } }));
    await assert.rejects(coordinator.save('vm', { groupUnassignedItems: true }), /Request failed/);
    assert.equal(coordinator.getSnapshot('vm').status, 'sync-pending');
    assert.equal(coordinator.getOptimisticPrefs('vm').groupUnassignedItems, true);
    const retained = JSON.parse(Object.values(storage.snapshot())[0]);
    assert.deepEqual(retained.operation.patch, { groupUnassignedItems: true });
    assert.equal(retained.operation.expectedRevision, 1);
    assert.equal(retained.operation.mutationId, 'retry-1');
    await coordinator.flush('vm');
    assert.deepEqual(writes[1], writes[0]);
    assert.equal(coordinator.getOptimisticPrefs('vm').groupUnassignedItems, true);
    assert.deepEqual(storage.snapshot(), {});
});

for (const reasonCode of ['nonce-stale', 'transaction-replayed']) {
    test(`a recovered preference operation retains its base and identity after ${reasonCode}`, async () => {
        const api = loadModule();
        const key = 'fvplus.prefs.outbox.v1.vm.old.1';
        const patch = { groupUnassignedItems: true };
        const original = outboxRecord('old', 7, patch);
        const storage = createStorage({ [key]: original });
        const calls = [];
        const confirmed = normalizePrefs({ groupUnassignedItems: false, _metadata: { prefsRevision: 7 } });
        const coordinator = api.createPreferenceSaveCoordinator({
            window: {}, sourceId: 'recovered', storage, normalizePrefs, debounceMs: 0,
            writePrefs: (_type, submitted, context) => {
                calls.push(structuredClone({ submitted, context }));
                if (calls.length === 1) throw Object.assign(new Error('Request guard needs a fresh nonce'), {
                    status: 409, phase: 'request', failureSource: 'folderview-plus', reasonCode
                });
                return { prefs: normalizePrefs({ ...submitted, _metadata: { prefsRevision: 8 } }) };
            }
        });
        coordinator.reconcile('vm', confirmed);
        await assert.rejects(coordinator.flush('vm'), /fresh nonce/);
        assert.equal(coordinator.getSnapshot('vm').status, 'sync-pending');
        assert.equal(coordinator.getSnapshot('vm').recoveryConflict, undefined);
        assert.equal(storage.getItem(key), original);
        await coordinator.flush('vm');
        assert.deepEqual(calls, [
            { submitted: patch, context: { expectedRevision: 7, clientMutationId: 'old-1' } },
            { submitted: patch, context: { expectedRevision: 7, clientMutationId: 'old-1' } }
        ]);
        assert.equal(coordinator.getSnapshot('vm').prefs.groupUnassignedItems, true);
        assert.deepEqual(storage.snapshot(), {});
    });
}

test('settings and dashboard layout commits reconcile without unrelated or stale writes restoring classic', async () => {
    const api = loadModule();
    const channels = [];
    class FakeBroadcastChannel {
        constructor(name) {
            this.name = name;
            this.listeners = [];
            channels.push(this);
        }
        addEventListener(kind, listener) {
            if (kind === 'message') {
                this.listeners.push(listener);
            }
        }
        postMessage(data) {
            channels
                .filter((channel) => channel !== this && channel.name === this.name)
                .forEach((channel) => channel.listeners.forEach((listener) => listener({ data })));
        }
    }
    let serverPrefs = normalizePrefs({
        dashboard: { layout: 'classic', greyscale: false },
        sortMode: 'created',
        _metadata: { prefsRevision: 1 }
    });
    const writePrefs = async (_type, patch, context) => {
        const revision = Number(serverPrefs._metadata.prefsRevision);
        if (Number(context.expectedRevision) !== revision) {
            const error = new Error('Conflict');
            error.status = 409;
            throw error;
        }
        serverPrefs = normalizePrefs(api.mergePatch(serverPrefs, patch));
        serverPrefs._metadata.prefsRevision = revision + 1;
        return {
            ok: true,
            prefs: serverPrefs,
            metadata: { prefsRevision: revision + 1 }
        };
    };
    const common = {
        normalizePrefs,
        debounceMs: 0,
        BroadcastChannel: FakeBroadcastChannel,
        storage: createStorage(),
        fetchPrefs: async () => ({
            prefs: serverPrefs,
            metadata: serverPrefs._metadata
        }),
        writePrefs
    };
    const settingsTab = api.createPreferenceSaveCoordinator({ ...common, sourceId: 'settings-tab' });
    const dashboardTab = api.createPreferenceSaveCoordinator({ ...common, sourceId: 'dashboard-tab' });
    const staleTab = api.createPreferenceSaveCoordinator({ ...common, sourceId: 'stale-tab', BroadcastChannel: null });
    const initial = normalizePrefs(serverPrefs);
    settingsTab.reconcile('docker', initial);
    dashboardTab.reconcile('docker', initial);
    staleTab.reconcile('docker', initial);

    await settingsTab.save('docker', { dashboard: { layout: 'compactmatrix' } }, { immediate: true });
    await wait(5);
    assert.equal(dashboardTab.getOptimisticPrefs('docker').dashboard.layout, 'compactmatrix');

    await dashboardTab.save('docker', { dashboard: { greyscale: true } }, { immediate: true });
    assert.equal(serverPrefs.dashboard.layout, 'compactmatrix');
    assert.equal(serverPrefs.dashboard.greyscale, true);

    const protectedStaleWrite = api.protectDashboardLayoutFromBroadPrefsWrite({
        ...initial,
        sortMode: 'manual',
        dashboard: { ...initial.dashboard, layout: 'classic' }
    });
    await staleTab.save('docker', protectedStaleWrite, { immediate: true });
    assert.equal(serverPrefs.dashboard.layout, 'compactmatrix');
    assert.equal(serverPrefs.sortMode, 'manual');
});

test('coordinator coalesces saved default replacements without resurrecting removed settings', async () => {
    const api = loadModule();
    let current = { folderDefaults: { profile: { icon: 'fixture-icon', settings: { preview: 4, preview_rows: 3 }, actions: [] } },
        dashboard: { privacyMaskNames: true }, _metadata: { prefsRevision: 1 } };
    const coordinator = api.createPreferenceSaveCoordinator({ normalizePrefs: value => value, debounceMs: 10,
        writePrefs: async (_type, patch) => ({ prefs: (current = api.mergePatch(current, patch)) }) });
    coordinator.reconcile('docker', current);
    const clear = { sourceId: '', sourceName: '', profile: { icon: '', settings: {}, actions: [] } };
    const smaller = { sourceId: 'other', sourceName: 'Other', profile: { icon: '', settings: { preview: 1 }, actions: [] } };
    await Promise.all([coordinator.save('docker', { folderDefaults: clear }), coordinator.save('docker', { folderDefaults: smaller }),
        coordinator.save('docker', { dashboard: { privacyMaskPorts: false } })]);
    assert.deepEqual(JSON.parse(JSON.stringify(coordinator.getOptimisticPrefs('docker').folderDefaults)), smaller);
    assert.deepEqual(JSON.parse(JSON.stringify(current.dashboard)), { privacyMaskNames: true, privacyMaskPorts: false });
});

test('merge patch preserves nested siblings and replaces arrays atomically', () => {
    const api = loadModule();
    const merged = api.mergePatch({
        dashboard: { names: true, ports: true },
        pinnedFolderIds: ['one', 'two']
    }, {
        dashboard: { ports: false },
        pinnedFolderIds: ['three']
    });
    assert.deepEqual(JSON.parse(JSON.stringify(merged)), {
        dashboard: { names: true, ports: false },
        pinnedFolderIds: ['three']
    });
});

test('preference retry policy retries transient failures but not permanent validation errors', () => {
    const api = loadModule();
    assert.equal(api.isRetryableSyncError(Object.assign(new Error('offline'), { status: 0 })), true);
    assert.equal(api.isRetryableSyncError(Object.assign(new Error('busy'), { status: 503 })), true);
    assert.equal(api.isRetryableSyncError(Object.assign(new Error('invalid'), { status: 400 })), false);
    assert.equal(api.isRetryableSyncError(Object.assign(new Error('conflict'), { status: 409 })), false);
});

test('a rejected preference batch clears its durable work and never attaches it to a later save', async () => {
    const api = loadModule();
    const storage = createStorage();
    const requests = [];
    let serverPrefs = normalizePrefs({ groupUnassignedItems: false, _metadata: { prefsRevision: 1 } });
    const options = {
        window: {}, storage, normalizePrefs, debounceMs: 0,
        fetchPrefs: async () => serverPrefs,
        writePrefs: async (_type, patch) => {
            requests.push(structuredClone(patch));
            if (patch.autoRules) throw Object.assign(new Error('Missing folder'), { status: 400, phase: 'request' });
            serverPrefs = normalizePrefs(api.mergePatch(serverPrefs, patch));
            serverPrefs._metadata.prefsRevision += 1;
            return { prefs: serverPrefs };
        }
    };
    const firstPage = api.createPreferenceSaveCoordinator({ ...options, sourceId: 'rejected-page' });
    firstPage.reconcile('docker', serverPrefs);
    await assert.rejects(firstPage.save('docker', { autoRules: [{ folderId: 'synthetic-missing' }] }), /Missing folder/);
    assert.equal(firstPage.getSnapshot('docker').pending, false);
    assert.equal(firstPage.getOptimisticPrefs('docker').autoRules, undefined);
    assert.deepEqual(storage.snapshot(), {});

    const reopened = api.createPreferenceSaveCoordinator({ ...options, sourceId: 'reopened-page' });
    await reopened.hydrateFromServer('docker');
    await reopened.save('docker', { groupUnassignedItems: true });
    assert.deepEqual(requests[1], { groupUnassignedItems: true });
    assert.equal(serverPrefs.groupUnassignedItems, true);
    assert.deepEqual(storage.snapshot(), {});
});

test('a permanent error preserves and flushes edits queued after the rejected request started', async () => {
    const api = loadModule();
    let rejectFirst;
    let requestStarted;
    const started = new Promise(resolve => { requestStarted = resolve; });
    const writes = [];
    const coordinator = api.createPreferenceSaveCoordinator({
        window: {}, storage: createStorage(), normalizePrefs, debounceMs: 0,
        writePrefs: (_type, patch) => {
            writes.push(structuredClone(patch));
            if (writes.length === 1) {
                return new Promise((_resolve, reject) => {
                    rejectFirst = reject;
                    requestStarted();
                });
            }
            return Promise.resolve({ prefs: { ...patch, _metadata: { prefsRevision: 2 } } });
        }
    });
    coordinator.reconcile('vm', { groupUnassignedItems: false, _metadata: { prefsRevision: 1 } });
    const rejected = assert.rejects(coordinator.save('vm', { autoRules: [{ folderId: 'synthetic-missing' }] }), /Invalid rule/);
    await started;
    const next = coordinator.save('vm', { groupUnassignedItems: true });
    rejectFirst(Object.assign(new Error('Invalid rule'), { status: 422 }));
    await rejected;
    assert.equal((await next).groupUnassignedItems, true);
    assert.deepEqual(writes[1], { groupUnassignedItems: true });
    assert.equal(coordinator.getSnapshot('vm').pending, false);
});

test('forced storage hydration cannot publish an older revision after a save commits', async () => {
    const api = loadModule();
    const handlers = {};
    let finishRead;
    const coordinator = api.createPreferenceSaveCoordinator({ normalizePrefs, storage: createStorage(), debounceMs: 0,
        window: { addEventListener: (kind, handler) => { handlers[kind] = handler; } },
        fetchPrefs: () => new Promise(resolve => { finishRead = resolve; }),
        writePrefs: async () => ({ prefs: { dashboard: { names: false } }, metadata: { prefsRevision: 3 } }) });
    coordinator.reconcile('docker', { dashboard: { names: true }, _metadata: { prefsRevision: 1 } });
    handlers.storage({ key: coordinator.storageKeyForType('docker'), newValue: null });
    await coordinator.save('docker', { dashboard: { names: false } }, { immediate: true });
    finishRead({ prefs: { dashboard: { names: true } }, metadata: { prefsRevision: 2 } });
    await wait(5);
    assert.equal(coordinator.getSnapshot('docker').revision, 3);
    assert.equal(coordinator.getOptimisticPrefs('docker').dashboard.names, false);
    coordinator.reconcile('docker', { dashboard: { names: true }, _metadata: { prefsRevision: 1 } }, { force: true });
    assert.equal(coordinator.getSnapshot('docker').revision, 3);
    assert.equal(coordinator.getOptimisticPrefs('docker').dashboard.names, false);
});

test('public save state and diagnostics share synchronization fields while preserving privacy and empty-value contracts', () => {
    const api = loadModule();
    const coordinator = api.createPreferenceSaveCoordinator({ normalizePrefs, storage: createStorage(),
        setTimeout: () => 1, clearTimeout: () => {} });
    coordinator.reconcile('docker', normalizePrefs({ _metadata: { prefsRevision: 7 } }));
    const before = coordinator.getSnapshot('docker');
    const diagnosticsBefore = coordinator.getDiagnostics().types.docker;
    assert.equal(before.lastError, ''); assert.equal(before.lastSavedAt, '');
    assert.equal(diagnosticsBefore.lastError, null); assert.equal(diagnosticsBefore.lastSavedAt, null);
    coordinator.save('docker', { dashboard: { names: false }, sortMode: 'manual' });
    coordinator.save('docker', { dashboard: { ports: false } });
    const state = coordinator.getSnapshot('docker'), diagnostic = coordinator.getDiagnostics().types.docker;
    for (const field of ['status', 'hydrated', 'pending', 'pendingFieldCount', 'revision', 'lastLatencyMs']) {
        assert.equal(state[field], diagnostic[field], field);
    }
    assert.equal(state.pendingFieldCount, 2, 'top-level fields count once across coalesced patches');
    for (const field of ['prefs', 'stats', 'lastBackup', 'lastMutationId', 'publicationGeneration']) {
        assert.equal(Object.hasOwn(diagnostic, field), false, field + ' must not be added to diagnostics');
    }
});

test('late write responses cannot replace newer confirmed cross-page preferences', async () => {
    const api = loadModule();
    let finishWrite;
    const coordinator = api.createPreferenceSaveCoordinator({ normalizePrefs, storage: createStorage(), debounceMs: 0,
        writePrefs: () => new Promise(resolve => { finishWrite = resolve; }) });
    coordinator.reconcile('docker', { dashboard: { names: true }, _metadata: { prefsRevision: 1 } });
    const saved = coordinator.save('docker', { dashboard: { names: false } }, { immediate: true });
    await wait(5);
    coordinator.reconcile('docker', { dashboard: { names: false, ports: false }, _metadata: { prefsRevision: 3 } });
    finishWrite({ prefs: { dashboard: { names: false, ports: true } }, metadata: { prefsRevision: 2 } });
    const result = await saved;
    assert.equal(coordinator.getSnapshot('docker').revision, 3);
    assert.equal(result.dashboard.ports, false);
    assert.equal(coordinator.getSnapshot('docker').pending, false);
});

test('legacy equal-revision hydration cannot undo preferences published while its request was pending', async () => {
    const api = loadModule();
    let finishRead;
    const coordinator = api.createPreferenceSaveCoordinator({ normalizePrefs, storage: createStorage(), debounceMs: 0,
        fetchPrefs: () => new Promise(resolve => { finishRead = resolve; }),
        writePrefs: async () => ({ prefs: { dashboard: { names: false } }, metadata: { prefsRevision: 0 } }) });
    coordinator.reconcile('docker', { dashboard: { names: true }, _metadata: { prefsRevision: 0 } });
    const read = coordinator.hydrateFromServer('docker', { force: true });
    await coordinator.save('docker', { dashboard: { names: false } }, { immediate: true });
    finishRead({ prefs: { dashboard: { names: true } }, metadata: { prefsRevision: 0 } });
    await read;
    assert.equal(coordinator.getOptimisticPrefs('docker').dashboard.names, false);
});

test('newer hydration revisions remain authoritative and pending local patches survive stale reads', async () => {
    const api = loadModule();
    const reads = [];
    const coordinator = api.createPreferenceSaveCoordinator({ normalizePrefs, storage: createStorage(), debounceMs: 1000,
        fetchPrefs: () => new Promise(resolve => { reads.push(resolve); }),
        writePrefs: async (_type, patch) => ({ prefs: api.mergePatch({ dashboard: { ports: false } }, patch), metadata: { prefsRevision: 5 } }) });
    coordinator.reconcile('docker', { dashboard: { names: true }, _metadata: { prefsRevision: 1 } });
    const olderRead = coordinator.hydrateFromServer('docker', { force: true });
    const newerRead = coordinator.hydrateFromServer('docker', { force: true });
    reads[1]({ prefs: { dashboard: { names: true, ports: false } }, metadata: { prefsRevision: 3 } });
    await newerRead;
    const save = coordinator.save('docker', { dashboard: { names: false } });
    reads[0]({ prefs: { dashboard: { names: true, ports: true } }, metadata: { prefsRevision: 4 } });
    await olderRead;
    assert.equal(coordinator.getSnapshot('docker').revision, 4, 'higher server revision wins even if its read started earlier');
    assert.equal(coordinator.getOptimisticPrefs('docker').dashboard.names, false, 'pending local intent remains visible');
    await coordinator.flush('docker');
    await save;
    assert.equal(coordinator.getSnapshot('docker').revision, 5);
    assert.equal(coordinator.getOptimisticPrefs('docker').dashboard.names, false);
});
