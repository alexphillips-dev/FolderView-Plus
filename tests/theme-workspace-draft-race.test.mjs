import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createApi } = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.theme-workspace.js');
const fixture = () => {
    const requests = [];
    const api = createApi({ apiGetJson: () => new Promise(resolve => requests.push(resolve)) });
    return { api, requests };
};

test('late initial workspace read preserves a preset draft and its undo state', async () => {
    const { api, requests } = fixture();
    const read = api.readWorkspace();
    api.previewPreset('blue');
    requests[0]({ workspace: {} });
    await read;
    assert.equal(api.getWorkspace().variables['--fvplus-theme-accent'], '#3b82f6');
    api.undoPreset();
    assert.equal(api.getWorkspace().variables['--fvplus-theme-accent'], undefined);
});

test('late refresh cannot resurrect tokens removed by a local reset', async () => {
    const { api, requests } = fixture();
    api.previewPreset('orange');
    const oldState = api.getWorkspace();
    const read = api.readWorkspace();
    api.resetTokens();
    requests[0]({ workspace: oldState });
    await read;
    assert.deepEqual(api.getWorkspace().variables, {});
});

test('newer read and authoritative workspace replacement fence older responses', async () => {
    for (const replacement of ['read', 'set']) {
        const { api, requests } = fixture();
        const first = api.readWorkspace();
        if (replacement === 'read') {
            const second = api.readWorkspace();
            requests[1]({ workspace: { lastCheckedAt: '2030-01-02' } });
            await second;
        } else api.setWorkspace({ lastCheckedAt: '2030-01-02' });
        requests[0]({ workspace: { lastCheckedAt: '2030-01-01' } });
        await first;
        assert.equal(api.getWorkspace().lastCheckedAt, '2030-01-02');
    }
});

test('unchanged workspace still adopts fresh server state and propagates read failures', async () => {
    const { api, requests } = fixture();
    const read = api.readWorkspace();
    requests[0]({ workspace: { lastCheckedAt: '2030-01-03' } });
    assert.equal((await read).lastCheckedAt, '2030-01-03');
    const failing = createApi({ apiGetJson: async () => { throw new Error('synthetic'); } });
    await assert.rejects(failing.readWorkspace(), /synthetic/);
});

test('checking for managed theme updates retains edits and preset undo while publishing the checked theme', async () => {
    const requests = [];
    const api = createApi({ apiPostJson: (_url, payload) => new Promise(resolve => requests.push({ payload, resolve })) });
    const profile = { id: 'default', name: 'Default', layers: { global: { variables: { '--fvplus-theme-accent': '#123456' } } } };
    const saved = { activeProfileId: profile.id, profiles: [profile], themes: [{ id: 'fixture', name: 'Fixture' }] };
    api.setWorkspace(saved);
    api.previewPreset('blue');
    const check = api.checkUpdates();
    api.previewPreset('green');
    assert.equal(requests[0].payload.action, 'check_updates');
    requests[0].resolve({ workspace: { ...saved, themes: [{ ...saved.themes[0], updateAvailable: true }], lastCheckedAt: '2030-01-02' } });
    await check;
    assert.equal(api.getWorkspace().themes[0].updateAvailable, true);
    assert.equal(api.getWorkspace().lastCheckedAt, '2030-01-02');
    assert.equal(api.getWorkspace().variables['--fvplus-theme-accent'], '#22c55e');
    api.undoPreset();
    assert.equal(api.getWorkspace().variables['--fvplus-theme-accent'], '#123456');
});

test('a refresh retains an existing draft and a stale check cannot replace newer workspace state', async () => {
    const reads = [], checks = [];
    const api = createApi({
        apiGetJson: () => new Promise(resolve => reads.push(resolve)),
        apiPostJson: () => new Promise(resolve => checks.push(resolve))
    });
    api.previewPreset('orange');
    const refresh = api.readWorkspace();
    reads[0]({ workspace: { lastCheckedAt: '2030-01-02' } });
    await refresh;
    assert.equal(api.getWorkspace().variables['--fvplus-theme-accent'], '#f97316');
    const staleCheck = api.checkUpdates();
    api.setWorkspace({ lastCheckedAt: '2030-01-04' });
    api.previewPreset('green');
    checks[0]({ workspace: { lastCheckedAt: '2030-01-03' } });
    assert.equal(await staleCheck, null);
    assert.equal(api.getWorkspace().lastCheckedAt, '2030-01-04');
    assert.equal(api.getWorkspace().variables['--fvplus-theme-accent'], '#22c55e');
});

test('a stale GitHub scan cannot replace a newer reviewed source or be imported', async () => {
    const scans = [];
    const imports = [];
    const api = createApi({
        apiPostJson: (_url, payload) => {
            if (payload.action === 'scan_github') return new Promise(resolve => scans.push(resolve));
            imports.push(payload);
            return Promise.resolve({ workspace: {} });
        }
    });
    const old = api.scanGithub('owner/old');
    const current = api.scanGithub('owner/current');
    const source = { input: 'https://github.com/owner/current/tree/main/compact', commitSha: 'a'.repeat(40) };
    scans[1]({ theme: { source } });
    await current;
    scans[0]({ theme: { source: { input: 'owner/old', commitSha: 'b'.repeat(40) } } });
    assert.equal(await old, null);
    assert.equal(await api.importGithub('owner/old'), null);
    await api.importGithub('owner/current');
    assert.deepEqual(imports, [{ action: 'import_github', source: source.input, commitSha: source.commitSha }]);
});

test('rapid profile selections write in order and subsequent edits address the displayed profile', async () => {
    const requests = [];
    const profiles = ['default', 'first', 'second'].map(id => ({ id, name: id }));
    const document = { getElementById: () => null, querySelector: () => null };
    const handlers = new Map();
    const $ = () => ({ off: () => ({ on: (event, _selector, handler) => handlers.set(event, handler) }) });
    const api = createApi({ document, $, apiPostJson: (_url, payload) => new Promise((resolve, reject) => {
        requests.push({ payload, resolve, reject });
    }) });
    api.setWorkspace({ activeProfileId: 'default', profiles });
    api.bindEvents();

    const select = value => {
        const target = { value };
        handlers.get('change.fvthemeprofile')({ target });
        assert.equal(target.value, api.getWorkspace().activeProfileId);
    };
    select('first');
    select('second');
    assert.deepEqual(requests.map(request => request.payload.profileId), ['first']);
    requests[0].resolve({ workspace: { activeProfileId: 'first', profiles } });
    await new Promise(setImmediate);
    assert.deepEqual(requests.map(request => request.payload.profileId), ['first', 'second']);
    requests[1].resolve({ workspace: { activeProfileId: 'second', profiles } });
    await new Promise(setImmediate);

    assert.equal(api.getWorkspace().activeProfileId, 'second');
    api.previewPreset('blue');
    const saving = api.saveCustomize();
    assert.equal(requests[2].payload.profileId, 'second');
    requests[2].resolve({});
    await new Promise(setImmediate);
    assert.equal(requests[3].payload.profileId, 'second');
    assert.equal(JSON.parse(requests[3].payload.variables)['--fvplus-theme-accent'], '#3b82f6');
    requests[3].resolve({ workspace: { activeProfileId: 'second', profiles } });
    await saving;

    select('first');
    select('second');
    requests[4].reject(new Error('Synthetic activation failure'));
    await new Promise(setImmediate);
    assert.equal(requests[5].payload.profileId, 'second');
    requests[5].resolve({ workspace: { activeProfileId: 'second', profiles } });
    await new Promise(setImmediate);
    assert.equal(api.getWorkspace().activeProfileId, 'second');
});

test('copying a profile preserves newer scope edits on the source profile', async () => {
    const requests = [];
    const handlers = new Map();
    const document = { getElementById: () => null, querySelector: () => null };
    const $ = () => ({ off: () => ({ on: (event, _selector, handler) => handlers.set(event, handler) }) });
    const api = createApi({ document, $, apiPostJson: (_url, payload) => new Promise(resolve => {
        requests.push({ payload, resolve });
    }) });
    const source = { id: 'default', name: 'Default' };
    api.setWorkspace({ activeProfileId: source.id, profiles: [source] });
    api.bindEvents();
    api.previewPreset('blue');

    const copying = api.saveAsProfile('Copy');
    assert.equal(requests[0].payload.scope, 'global');
    const submitted = JSON.parse(requests[0].payload.variables);
    const copy = { id: 'copy', name: 'Copy', layers: { global: { variables: submitted } } };
    handlers.get('change.fvthemescope')({ target: { value: 'docker' } });
    api.previewPreset('green');
    requests[0].resolve({ workspace: { activeProfileId: copy.id, profiles: [source, copy] } });
    await copying;

    const workspace = api.getWorkspace();
    assert.equal(workspace.activeProfileId, copy.id);
    assert.equal(workspace.variables['--fvplus-theme-accent'], undefined);
    assert.equal(workspace.profiles.find(profile => profile.id === copy.id).layers.global.variables['--fvplus-theme-accent'], '#3b82f6');
    handlers.get('change.fvthemeprofile')({ target: { value: source.id } });
    requests[1].resolve({ workspace: { activeProfileId: source.id, profiles: [source, copy] } });
    await new Promise(setImmediate);
    assert.equal(api.getWorkspace().variables['--fvplus-theme-accent'], '#22c55e');
    handlers.get('change.fvthemescope')({ target: { value: 'global' } });
    assert.equal(api.getWorkspace().variables['--fvplus-theme-accent'], '#3b82f6');
});
