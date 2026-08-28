import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const repoRoot = path.resolve(process.cwd());
const sourcePath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.settings-transfer.js'
);
const source = fs.readFileSync(sourcePath, 'utf8');

const createStorage = () => {
    const store = new Map();
    return {
        getItem(key) {
            return store.has(key) ? store.get(key) : null;
        },
        setItem(key, value) {
            store.set(String(key), String(value));
        },
        removeItem(key) {
            store.delete(String(key));
        }
    };
};

const loadApi = () => {
    const sessionStorage = createStorage();
    const localStorage = createStorage();
    const context = {
        module: { exports: {} },
        exports: {},
        console,
        Date,
        JSON,
        globalThis: {},
        window: {
            sessionStorage,
            localStorage
        }
    };
    context.globalThis = context;
    vm.createContext(context);
    vm.runInContext(source, context);
    const moduleApi = context.module.exports;
    return {
        api: moduleApi.createApi({ window: context.window }),
        sessionStorage,
        localStorage
    };
};

test('folder settings transfer copies only safe settings payload fields', () => {
    const { api } = loadApi();
    const entry = api.buildClipboardEntry('docker', {
        name: 'Source Folder',
        parentId: 'parent-1',
        regex: '.*',
        containers: ['one', 'two'],
        icon: 'folder.png',
        settings: {
            preview: 2,
            override_default_actions: true,
            webui_profiles: [{ id: 'media', name: 'Media', containers: ['one'] }]
        },
        actions: [
            { type: 1, name: 'Script action', script: 'echo ok' },
            { type: 0, name: 'Member action', conatiners: ['one'] }
        ]
    }, {
        sourceId: 'folder-a',
        sourceName: 'Source Folder'
    });

    assert.equal(entry.type, 'docker');
    assert.deepEqual(Object.keys(entry.payload).sort(), ['actions', 'icon', 'settings']);
    assert.equal(entry.payload.icon, 'folder.png');
    assert.equal(entry.payload.settings.preview, 2);
    assert.equal(entry.payload.settings.webui_profiles, undefined);
    assert.equal(entry.payload.actions.length, 1);
    assert.equal(entry.payload.actions[0].name, 'Script action');
    assert.deepEqual(Array.from(entry.meta.omittedTopLevelKeys), ['name', 'parentId', 'regex', 'containers', 'id', 'createdAt', 'updatedAt']);
    assert.equal(entry.meta.copiedActionCount, 1);
    assert.equal(entry.meta.droppedMemberBoundActionCount, 1);
});

test('folder settings transfer disables override_default_actions when copied actions are unsafe', () => {
    const { api } = loadApi();
    const normalized = api.normalizeFolderSettingsPayload({
        icon: 'folder.png',
        settings: {
            override_default_actions: true
        },
        actions: [
            { type: 0, name: 'Unsafe action', containers: ['abc'] }
        ]
    });

    assert.equal(normalized.payload.actions.length, 0);
    assert.equal(normalized.payload.settings.override_default_actions, false);
    assert.equal(normalized.meta.droppedMemberBoundActionCount, 1);
});

test('folder settings transfer clipboard reads are type-scoped for docker and vm', () => {
    const { api } = loadApi();
    const dockerEntry = api.buildClipboardEntry('docker', {
        icon: 'docker.png',
        settings: {},
        actions: []
    }, {
        sourceId: 'docker-folder',
        sourceName: 'Docker Source'
    });

    assert.equal(api.writeClipboardEntry(dockerEntry), true);
    assert.equal(api.readClipboardEntry('docker')?.sourceId, 'docker-folder');
    assert.equal(api.readClipboardEntry('vm'), null);
});
