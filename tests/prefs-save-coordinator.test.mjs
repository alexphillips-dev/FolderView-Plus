import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

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
        'fvplus.prefs.outbox.v1.docker': JSON.stringify({
            schemaVersion: 1,
            type: 'docker',
            sourceId: 'closed-tab',
            updatedAt: '2026-07-15T12:00:00.000Z',
            patch: { dashboard: { ports: false } }
        })
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
        writePrefs: async (_type, patch) => {
            writes.push(patch);
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
    assert.equal(storage.getItem('fvplus.prefs.outbox.v1.docker'), null);
});

test('preference coordinator replays a restored outbox after raw runtime reconciliation', async () => {
    const api = loadModule();
    const storage = createStorage({
        'fvplus.prefs.outbox.v1.docker': JSON.stringify({
            schemaVersion: 1,
            type: 'docker',
            sourceId: 'settings-page',
            updatedAt: '2026-07-15T12:00:00.000Z',
            patch: { dashboard: { privacyMaskNames: false } }
        })
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
