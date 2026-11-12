import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createSubmitHandler, recordSubmitDiagnostics } = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.submit.js');
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

function fixture(overrides = {}) {
    const calls = [], records = [], errors = [];
    const context = {
        validateForm: () => true, buildFolderPayloadFromForm: () => ({ name: 'Fixture', settings: { preview: 2 } }),
        activeFolderEditorFolderId: 'fixture', folderId: 'fixture', allFoldersById: { fixture: { name: 'Fixture' } },
        normalizeFolderRecordForEditor: value => value, initialSnapshot: 'saved', computeFormSnapshot: () => 'saved',
        editingFolderDefaults: false, folderEditorExpectedFolderRevision: 4, type: 'docker',
        generateCopyName: name => `${name} copy`, surfaceT: (_key, text) => text, setFieldError: () => {},
        securePost: async (url, body) => { calls.push({ url, body }); return { metadata: { folderRevision: 5 } }; },
        flushPostSaveTypeSync: async () => { calls.push({ sync: true }); },
        recordFolderEditorSubmitDiagnostics: record => records.push(record),
        suppressUnloadPrompt: false, location: { pathname: '/Docker/Folder', href: '/Docker/Folder?id=fixture' },
        extractAjaxErrorMessage: error => error.message, alert: text => errors.push(text), window: {}, ...overrides
    };
    const handler = createSubmitHandler({ ...context,
        window: { ...context.window, location: context.location, alert: context.alert },
        getState: () => context,
        setExpectedRevision: value => { context.folderEditorExpectedFolderRevision = value; },
        setSuppressUnloadPrompt: value => { context.suppressUnloadPrompt = value; },
        recordDiagnostics: context.recordFolderEditorSubmitDiagnostics
    });
    return { context, calls, records, errors, run: copy => handler({}, copy) };
}

test('unchanged edits leave without mutation, synchronization or revision writes', async () => {
    for (const pathname of ['/Docker/Folder', '/VMs/Folder']) {
        const f = fixture({ location: { pathname, href: pathname } });
        await f.run();
        assert.equal(f.calls.length, 0);
        assert.equal(f.context.location.href, pathname.slice(0, pathname.lastIndexOf('/')));
        assert.equal(f.context.folderEditorExpectedFolderRevision, 4);
        assert.equal(f.records[0].unchanged, true);
    }
});

test('changed appearance waits for persistence and order reconciliation before leaving', async () => {
    const save = deferred(), sync = deferred();
    const f = fixture({ computeFormSnapshot: () => 'changed', securePost: () => save.promise, flushPostSaveTypeSync: () => sync.promise });
    const pending = f.run();
    assert.equal(f.context.location.href, '/Docker/Folder?id=fixture');
    save.resolve({ metadata: { folderRevision: 5 }, timings: { bootstrapMs: 2, guardMs: 3, saveMs: 4 } });
    await new Promise(setImmediate);
    assert.equal(f.context.location.href, '/Docker/Folder?id=fixture');
    sync.resolve(); await pending;
    assert.equal(f.context.location.href, '/Docker');
    assert.equal(f.context.folderEditorExpectedFolderRevision, 5);
    assert.equal(f.records[0].saveMs, 4);
    assert.equal(f.records[0].guardMs, 3);
    assert.equal(f.records[0].ok, true);
});

test('copies, new folders and incomplete baselines never take the unchanged shortcut', async () => {
    for (const options of [{ copy: true }, { folderId: '', activeFolderEditorFolderId: '' }, { initialSnapshot: '' }, { allFoldersById: {} }]) {
        const f = fixture(options); await f.run(options.copy);
        assert.equal(f.calls.filter(call => call.url).length, 1);
        assert.equal(f.records[0].unchanged, false);
    }
});

test('save and post-save failures retain the editor and record only numeric and boolean outcomes', async () => {
    for (const phase of ['save', 'sync']) {
        const f = fixture({ computeFormSnapshot: () => 'changed',
            ...(phase === 'save' ? { securePost: async () => { throw Error('rejected'); } }
                : { flushPostSaveTypeSync: async () => { throw Error('rejected'); } }) });
        await f.run();
        assert.equal(f.context.location.href, '/Docker/Folder?id=fixture');
        assert.equal(f.errors[0], 'rejected');
        assert.equal(f.records[0].ok, false);
        assert.ok(Object.values(f.records[0]).every(value => typeof value === 'number' || typeof value === 'boolean'));
    }
});

test('submit timings survive navigation in the existing diagnostics record and tolerate blocked storage', () => {
    const values = new Map([['bootstrap', JSON.stringify({ result: 'loaded' })]]);
    const context = { localStorage: {
        getItem: key => values.get(key), setItem: (key, value) => values.set(key, value)
    } };
    const record = details => recordSubmitDiagnostics(context, 'bootstrap', details);
    record({ ok: true, unchanged: false, requestMs: 120, syncMs: -1, durationMs: 900000,
        privateName: 'must-not-persist', bootstrapMs: '123', guardMs: Infinity });
    const saved = JSON.parse(values.get('bootstrap'));
    assert.equal(saved.result, 'loaded');
    assert.equal(saved.lastSubmit.requestMs, 120);
    assert.equal(saved.lastSubmit.ok, true);
    assert.equal(saved.lastSubmit.syncMs, 0);
    assert.equal(saved.lastSubmit.durationMs, 600000);
    assert.equal(saved.lastSubmit.privateName, undefined);
    assert.equal(saved.lastSubmit.bootstrapMs, undefined);
    assert.equal(saved.lastSubmit.guardMs, undefined);
    context.localStorage.getItem = () => { throw Error('storage blocked'); };
    assert.doesNotThrow(() => record({ ok: true }));
});

test('invalid forms never leave through the unchanged shortcut', async () => {
    const f = fixture({ validateForm: () => false });
    await f.run();
    assert.equal(f.context.location.href, '/Docker/Folder?id=fixture');
    assert.equal(f.calls.length, 0);
    assert.equal(f.records.length, 0);
    assert.equal(f.context.suppressUnloadPrompt, false);
});

test('server timings accept only finite numeric values and bound copied values', async () => {
    const f = fixture({ computeFormSnapshot: () => 'changed', securePost: async () => ({
        metadata: { folderRevision: 5 }, timings: { bootstrapMs: Infinity, guardMs: -1, saveMs: 900000 }
    }) });
    await f.run();
    assert.equal(f.records[0].bootstrapMs, undefined);
    assert.equal(f.records[0].guardMs, undefined);
    assert.equal(f.records[0].saveMs, 600000);
});

test('reused submit handlers read live revisions and baselines for every submission', async () => {
    const f = fixture({ computeFormSnapshot: () => 'changed' });
    await f.run();
    await f.run();
    assert.deepEqual(f.calls.filter(call => call.url).map(call => call.body.expectedRevision), [4, 5]);
    f.context.initialSnapshot = 'changed';
    const requestCount = f.calls.length;
    await f.run();
    assert.equal(f.calls.length, requestCount);
    assert.equal(f.records.at(-1).unchanged, true);
});
