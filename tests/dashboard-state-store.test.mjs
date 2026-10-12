import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const scripts = new URL('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/', import.meta.url);
const fixture = (initial = {}) => {
    let now = 0, nextTimer = 0, denied = false;
    const timers = new Map(), records = new Map(Object.entries(initial));
    const storage = { getItem: key => records.get(key) ?? null,
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
    const disk = type => JSON.parse(records.get(key(type)) || '{}');
    return { store, writer, records, key, read, disk, advance, deny: value => { denied = value; } };
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
        const fresh = fixture({ [f.key(type)]: JSON.stringify(f.disk(type)) });
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

    test(`${type} observed external state adopts current disk after pending local writes settle`, () => {
        const f = fixture();
        f.store.patch(type, { local: true });
        f.records.set(f.key(type), '{"external":true}');
        assert.deepEqual(f.read(type), { local: true }, 'queued local write retains last-write precedence');
        f.records.set(f.key(type), '{"local":false,"external":true}');
        assert.deepEqual(f.read(type), { local: false, external: true });
        f.store.patch(type, { next: true }); f.writer.flush();
        f.records.set(f.key(type), '{"afterAutomaticCommit":true}');
        assert.deepEqual(f.read(type), { afterAutomaticCommit: true }, 'external writes are adopted even without an earlier acknowledgement read');
        f.records.set(f.key(type), '{broken'); assert.deepEqual(f.read(type), {});
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
