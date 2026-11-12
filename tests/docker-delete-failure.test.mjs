import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createApi } = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.actions.js');

function fixture({ fail = false, locked = false } = {}) {
    const events = [];
    let confirm;
    const api = createApi({
        window: { setTimeout: callback => { events.push('schedule-refresh'); callback(); } },
        $: () => ({ show: () => events.push('show'), hide: () => events.push('hide') }),
        swal: (_options, callback) => { confirm = callback; },
        getGlobalFolders: () => ({ folder: { name: 'Fixture folder' } }),
        ensureDockerFolderUnlocked: () => !locked,
        requestClient: { postJson: async (url, payload) => {
            events.push({ url, payload });
            if (fail) throw new Error('Fixture request failure');
            return { ok: true };
        } },
        runDockerGuardedAction: async (name, action, options) => {
            try { await action(); return { ok: true }; }
            catch { events.push({ errorReported: name, userVisible: options.userVisible }); return { ok: false }; }
        },
        loadlist: () => events.push('refresh')
    });
    api.rmFolder('folder');
    return { events, confirm };
}

test('failed single-folder deletion reports failure and releases the spinner without success refresh', async () => {
    const { events, confirm } = fixture({ fail: true });
    await assert.doesNotReject(confirm(true));
    assert.ok(events.includes('hide'));
    assert.ok(events.some(event => event?.errorReported === 'delete-folder' && event.userVisible === true));
    assert.ok(!events.includes('refresh'));
});

test('successful single-folder deletion preserves the endpoint and refreshes with spinner released', async () => {
    const { events, confirm } = fixture();
    await confirm(true);
    assert.deepEqual(events.find(event => event?.url), {
        url: '/plugins/folderview.plus/server/delete.php', payload: { type: 'docker', id: 'folder' }
    });
    assert.ok(events.includes('refresh'));
    assert.ok(events.includes('hide'));
});

test('cancelling or locking single-folder deletion sends no delete request', async () => {
    const cancelled = fixture();
    await cancelled.confirm(false);
    assert.ok(!cancelled.events.some(event => event?.url));
    assert.ok(!cancelled.events.includes('show'));
    const locked = fixture({ locked: true });
    assert.equal(locked.confirm, undefined);
    assert.deepEqual(locked.events, []);
});
