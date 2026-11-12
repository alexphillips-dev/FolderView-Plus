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
