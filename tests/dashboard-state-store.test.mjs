import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const scripts = new URL('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/', import.meta.url);
const fixture = (initial = {}) => {
    let now = 0, nextTimer = 0, denied = false;
    const timers = new Map(), records = new Map(Object.entries(initial));
    const storage = { get length() { return records.size; }, key: index => [...records.keys()][index] ?? null,
        getItem: key => records.get(key) ?? null,
        setItem: (key, value) => { if (denied) throw new Error('Quota denied'); records.set(key, value); },
        removeItem: key => { if (denied) throw new Error('Remove denied'); records.delete(key); } };
    const context = { module: { exports: {} }, setTimeout: (callback, delay) => {
        const id = ++nextTimer; timers.set(id, { at: now + delay, callback }); return id;
    }, clearTimeout: id => timers.delete(id), console };
    context.window = { localStorage: storage };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(new URL('folderviewplus.utils-foundation.js', scripts), 'utf8'), context);
    const foundation = context.module.exports;
    context.module = { exports: {} }; context.require = () => foundation;
    vm.runInContext(fs.readFileSync(new URL('dashboard.state-store.js', scripts), 'utf8'), context);
    const api = context.module.exports, writer = foundation.createBatchedStorageWriter(storage);
    const store = api.createStore({ window: context.window, storage, writer });
    const advance = delay => {
        const until = now + delay;
        for (;;) {
            const due = [...timers].filter(([, timer]) => timer.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
            if (!due) break;
            timers.delete(due[0]); now = due[1].at; due[1].callback();
        }
        now = until;
    };
    const key = type => api.EXPANDED_STATE_STORAGE_KEYS[type];
    const read = type => JSON.parse(JSON.stringify(store.read(type)));
    const disk = type => JSON.parse(JSON.stringify(api.createStore({ storage }).read(type)));
    const createPeer = ({ staleLegacyRead = false } = {}) => {
        const peerStorage = staleLegacyRead ? Object.create(storage, {
            getItem: { value: item => item === key('docker') ? null : storage.getItem(item) }
        }) : storage;
        const peerWriter = foundation.createBatchedStorageWriter(peerStorage);
        return { store: api.createStore({ storage: peerStorage, writer: peerWriter }), writer: peerWriter };
    };
    return { store, writer, records, key, read, disk, advance, createPeer, deny: value => { denied = value; } };
};

for (const type of ['docker', 'vm']) {
    test(`${type} rapid patches merge before the 80ms debounce and idle commit`, () => {
        const f = fixture();
        assert.equal(f.store.patch(type, { parent: true }), true);
        assert.equal(f.store.patch(type, { child: true }), true);
        assert.equal(f.store.patch(type, { parent: false, other: true }), true);
        assert.deepEqual(f.read(type), { parent: false, child: true, other: true });
        f.advance(79); assert.deepEqual(f.disk(type), {});
        f.advance(1); assert.deepEqual(f.disk(type), {});
        f.advance(32); assert.deepEqual(f.disk(type), f.read(type));
        const fresh = fixture(Object.fromEntries(f.records));
        assert.deepEqual(fresh.read(type), { parent: false, child: true, other: true });
    });

    test(`${type} clear cancels pending and already idle-queued values through later flush`, () => {
        for (const elapsed of [0, 80]) {
            const f = fixture();
            f.store.patch(type, { stale: true }); f.advance(elapsed);
            assert.equal(f.store.clear(type), true);
            assert.deepEqual(f.read(type), {});
            f.writer.flush(); f.advance(1000);
            assert.equal(f.records.has(f.key(type)), false);
            f.store.patch(type, { fresh: true }); f.writer.flush();
            assert.deepEqual(f.disk(type), { fresh: true });
        }
    });

    test(`${type} full-map reset replaces pending state and read results cannot mutate it`, () => {
        const f = fixture();
        f.store.patch(type, { stale: true });
        const exposed = f.store.read(type); exposed.injected = true;
        assert.deepEqual(f.read(type), { stale: true });
        f.store.write(type, {}); f.writer.flush(); f.advance(1000);
        assert.deepEqual(f.disk(type), {});
        f.store.patch(type, { afterReset: true }); f.writer.flush();
        assert.deepEqual(f.disk(type), { afterReset: true });
    });

    test(`${type} pending local changes overlay current storage without erasing unrelated external state`, () => {
        const f = fixture();
        f.store.patch(type, { local: true });
        f.records.set(f.key(type), '{"external":true}');
        assert.deepEqual(f.read(type), { local: true, external: true });
        assert.deepEqual(f.disk(type), { external: true });
        f.writer.flush();
        assert.deepEqual(f.disk(type), { local: true, external: true });
        const peer = f.createPeer();
        peer.store.patch(type, { local: false }); peer.writer.flush();
        assert.deepEqual(f.read(type), { local: false, external: true });
        f.store.patch(type, { next: true }); f.writer.flush();
        peer.store.write(type, { afterAutomaticCommit: true });
        assert.deepEqual(f.read(type), { afterAutomaticCommit: true }, 'external writes are adopted even without an earlier acknowledgement read');
        const corruptedLegacy = fixture({ [f.key(type)]: '{broken' });
        assert.deepEqual(corruptedLegacy.read(type), {});
    });

    test(`${type} failed writes preserve session state and failed clear cannot queue resurrection`, () => {
        const f = fixture(); f.deny(true);
        f.store.patch(type, { first: true }); f.advance(112);
        assert.deepEqual(f.read(type), { first: true });
        f.deny(false); f.store.patch(type, { second: true }); f.writer.flush();
        assert.deepEqual(f.disk(type), { first: true, second: true });
        f.store.patch(type, { stale: true }); f.deny(true);
        assert.equal(f.store.clear(type), false);
        assert.deepEqual(f.read(type), {});
        f.deny(false); f.writer.flush(); f.advance(1000);
        assert.equal(f.disk(type).stale, undefined, 'clear failure does not leave the previous queued setter alive');
    });
}

test('Dashboard keys and unrelated shared-writer keys stay isolated', () => {
    const f = fixture();
    f.store.patch('docker', { dockerOnly: true }); f.store.patch('vm', { vmOnly: true });
    f.writer.setItem('unrelated-preference', 'keep');
    f.store.clear('docker'); f.writer.flush(); f.advance(1000);
    assert.deepEqual(f.disk('docker'), {}); assert.deepEqual(f.disk('vm'), { vmOnly: true });
    assert.equal(f.records.get('unrelated-preference'), 'keep');
});

test('Dashboard expansion writes merge disjoint changes in both tab flush orders', () => {
    for (const firstWritesLast of [false, true]) {
        const f = fixture(), peer = f.createPeer();
        f.store.patch('docker', { first: true, shared: true });
        peer.store.patch('docker', { second: true, shared: false });
        const [firstWriter, lastWriter] = firstWritesLast ? [peer.writer, f.writer] : [f.writer, peer.writer];
        firstWriter.flush();
        f.read('docker'); // A read from the tab with pending local edits must leave the writer queued.
        lastWriter.flush();
        assert.deepEqual(f.disk('docker'), { first: true, second: true, shared: firstWritesLast });
    }
});

test('Dashboard disjoint writes survive a peer reading its stale origin snapshot during commit', () => {
    const f = fixture(), peer = f.createPeer({ staleLegacyRead: true });
    f.store.patch('docker', { first: true });
    peer.store.patch('docker', { second: true });
    f.writer.flush(); peer.writer.flush();
    assert.deepEqual(f.disk('docker'), { first: true, second: true });
});

test('Dashboard reads legacy expansion and a peer reset fences queued work', () => {
    const key = fixture().key('docker');
    const f = fixture({ [key]: '{"legacy":true}' }), peer = f.createPeer();
    assert.deepEqual(f.read('docker'), { legacy: true });
    f.store.patch('docker', { stale: true });
    peer.store.patch('docker', { previous: false }); peer.writer.flush();
    assert.equal(peer.store.clear('docker'), true);
    f.writer.flush();
    assert.deepEqual(f.disk('docker'), {});
    f.store.patch('docker', { fresh: true }); f.writer.flush();
    assert.deepEqual(f.disk('docker'), { fresh: true });
    assert.equal([...f.records.keys()].filter(key => key.includes('.entry.')).length, 1);
});
