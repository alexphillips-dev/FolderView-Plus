import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
const require = createRequire(import.meta.url);
const root = '../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus';
const transferModule = require(`${root}/scripts/folder.settings-transfer.js`);
const menuModule = require(`${root}/scripts/folder.settings-menu.js`);
const actionsModule = require(`${root}/scripts/docker.runtime.actions.js`);
const schema = JSON.parse(fs.readFileSync('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/schemas/folder-settings-transfer.schema.json', 'utf8'));
const storage = (values = new Map()) => ({ getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) });
const folder = { name: 'Source fixture', icon: 'source.svg', settings: { preview: 4, expand_tab: true, preview_border_color: '#123456',
    webui_profiles: [{ id: 'source', name: 'Source', containers: ['member'] }], child_folder_order: ['source-child'] },
    containers: ['member'], regex: 'member', actions: [{ type: 1, name: 'Script', script: 'echo fixture' }, { type: 0, name: 'Member', containers: ['member'] }] };
const create = (options = {}) => {
    const events = {}, notifications = [], alerts = [], requests = [];
    const win = { localStorage: storage(), sessionStorage: storage(), addEventListener: (name, handler) => { events[name] = handler; }, ...options.window };
    const transfer = transferModule.createApi({ window: win, schema });
    let refreshes = 0;
    const ui = { announce: message => notifications.push(message.message), alert: async message => alerts.push(message), confirm: async () => true, ...options.ui };
    const api = menuModule.createApi({ window: win, transfer, ui, getFolder: () => folder, ensureUnlocked: () => true,
        refresh: () => { refreshes++; }, post: async (_url, data) => { requests.push(data); return { result: { updatedCount: 1, folderRevision: 7, changes: { target: ['appearance'] } } }; },
        ...options, ui });
    return { api, transfer, win, notifications, alerts, requests, events, refreshes: () => refreshes };
};
test('category copies contain only the selected category and expose valid paste choices', async () => {
    const fixture = create();
    await fixture.api.copy('source', 'appearance');
    const entry = fixture.transfer.readClipboardEntry('docker');
    assert.deepEqual(entry.categories, ['appearance']);
    assert.deepEqual(Object.keys(entry.payload.settings), ['preview_border_color']);
    assert.equal(entry.payload.icon, folder.icon);
    assert.deepEqual(entry.payload.actions, []);
    assert.equal(entry.meta.droppedMemberBoundActionCount, 0);
    assert.equal(entry.meta.copiedActionCount, 0);
    assert.equal(fixture.alerts.length, 0, 'copy should give a brief notification');
    assert.match(fixture.notifications[0], /Appearance copied/);
    const menu = fixture.api.buildMenuItems('target');
    assert.deepEqual(menu[1].subMenu.map(item => item.disabled), [false, false, true, true, true]);
    assert.match(menu[1].text, /Source fixture/);
    await menu[1].subMenu[2].action({ preventDefault() {} });
    assert.equal(fixture.requests.length, 0, 'disabled categories must not send requests');
});
test('paste previews and applies exactly the copied categories with the checked revision', async () => {
    const fixture = create();
    await fixture.api.copy('source', 'appearance');
    await fixture.api.paste('target', 'all');
    assert.equal(fixture.requests.length, 2);
    assert.equal(fixture.requests[0].preview, '1');
    assert.equal(fixture.requests[1].expectedRevision, 7);
    assert.deepEqual(JSON.parse(fixture.requests[1].categories), ['appearance']);
    assert.equal(fixture.refreshes(), 1);
    assert.match(fixture.notifications.at(-1), /Appearance applied/);
});
test('identical paste skips confirmation, apply, and refresh', async () => {
    let confirmations = 0;
    const fixture = create({ post: async () => ({ result: { updatedCount: 0 } }), ui: { confirm: async () => { confirmations++; return true; } } });
    await fixture.api.copy('source', 'appearance');
    await fixture.api.paste('target', 'appearance');
    assert.equal(confirmations, 0);
    assert.equal(fixture.refreshes(), 0);
    assert.match(fixture.notifications.at(-1), /already matches/);
});
test('cancelled confirmation and a folder locked during confirmation cannot apply', async () => {
    for (const cancel of [true, false]) {
        let unlocked = true;
        const fixture = create({ ensureUnlocked: () => unlocked, ui: { confirm: async () => { unlocked = false; return !cancel; } } });
        await fixture.api.copy('source', 'appearance');
        await fixture.api.paste('target', 'appearance');
        assert.equal(fixture.requests.length, 1);
        assert.equal(fixture.refreshes(), 0);
    }
});
test('clipboard changes during confirmation fail safely before applying', async () => {
    let fixture;
    fixture = create({ ui: { confirm: async () => { fixture.transfer.clearClipboardEntry(); return true; } } });
    await fixture.api.copy('source', 'appearance');
    await fixture.api.paste('target', 'appearance');
    assert.equal(fixture.requests.length, 1);
    assert.equal(fixture.alerts.length, 1);
});
test('late preview responses after leaving the page do not open confirmation or mutate', async () => {
    let release, confirmations = 0;
    const fixture = create({ post: () => new Promise(resolve => { release = resolve; }), ui: { confirm: async () => { confirmations++; return true; } } });
    await fixture.api.copy('source', 'appearance');
    const pending = fixture.api.paste('target', 'appearance');
    await new Promise(resolve => setImmediate(resolve));
    fixture.events.pagehide();
    release({ result: { updatedCount: 1, folderRevision: 7, changes: {} } });
    await pending;
    assert.equal(confirmations, 0);
    assert.equal(fixture.refreshes(), 0);
});
test('clipboard chooses the newest tab copy and clearing it invalidates older session copies', () => {
    const shared = storage();
    const a = transferModule.createApi({ schema, window: { localStorage: shared, sessionStorage: storage() } });
    const b = transferModule.createApi({ schema, window: { localStorage: shared, sessionStorage: storage() } });
    const first = a.buildClipboardEntry('docker', folder);
    a.writeClipboardEntry(first);
    const second = b.buildClipboardEntry('docker', { ...folder, name: 'Newer' });
    b.writeClipboardEntry(second);
    assert.equal(a.readClipboardEntry('docker').sourceName, 'Newer');
    b.clearClipboardEntry();
    assert.equal(a.readClipboardEntry('docker'), null);
    a.writeClipboardEntry(first);
    assert.equal(b.readClipboardEntry('docker').sourceName, folder.name);
    b.writeClipboardEntry(b.buildClipboardEntry('vm', folder));
    assert.equal(a.readClipboardEntry('docker'), null, 'a newer VM copy must disable stale Docker copies');
    assert.equal(a.readClipboardEntry('vm').type, 'vm');
});
test('legacy clipboard entries remain compatible and malformed category data is rejected', () => {
    const fixture = create();
    const entry = fixture.transfer.buildClipboardEntry('docker', folder);
    const key = transferModule.CLIPBOARD_LOCAL_STORAGE_KEY;
    fixture.win.localStorage.setItem(key, JSON.stringify({ ...entry, schemaVersion: 1, categories: undefined }));
    assert.deepEqual(fixture.transfer.readClipboardEntry('docker').categories, schema.categories);
    for (const categories of [[], ['unsafe'], null]) {
        fixture.win.localStorage.setItem(key, JSON.stringify({ ...entry, categories }));
        assert.equal(fixture.transfer.readClipboardEntry('docker'), null);
    }
});
test('clipboard inspector shows category and time details without exposing scripts', async () => {
    const fixture = create();
    await fixture.api.copy('source');
    await fixture.api.view();
    assert.match(fixture.alerts[0].message, /Source fixture.*Copied:.*Categories:.*Settings:.*Script actions: 1/);
    assert.doesNotMatch(fixture.alerts[0].message, /echo fixture/);
    fixture.api.clear();
    assert.equal(fixture.transfer.readClipboardEntry(), null);
});
test('settings-only clone starts empty, omits member references and actions, and suggests a unique name', async () => {
    const requests = [];
    const transfer = transferModule.createApi({ schema });
    const api = actionsModule.createApi({ window: { prompt: (_label, name) => name }, folderSettingsTransfer: transfer,
        getGlobalFolders: () => ({ source: folder, copy: { name: 'Source fixture (Copy)' } }), ensureDockerFolderUnlocked: () => true,
        requestClient: { postJson: async (url, data) => { requests.push({ url, data }); } }, runDockerGuardedAction: async (_name, action) => action() });
    await api.cloneDockerFolderSettingsOnlyFromMenu('source');
    const created = JSON.parse(requests[0].data.content);
    assert.equal(created.name, 'Source fixture (Copy 2)');
    assert.equal(created.regex, '');
    assert.deepEqual(created.containers, []);
    assert.deepEqual(created.actions, []);
    for (const key of schema.protectedSettings) assert.equal(created.settings[key], undefined);
    assert.equal(created.settings.preview, 4);
    assert.equal(requests[1].url.endsWith('/sync_order.php'), true);
});
