import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const workspaces = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-workspaces.js');
const summary = { docker: { folderCount: 2 }, vm: { folderCount: 1 }, themeWorkspace: {} };
const fixture = (response, refresh = async () => ({ hasErrors: false }), themeRefresh = async () => {}, backupsRefresh = async () => true) => {
    const calls = [], notices = [], errors = [];
    let confirm;
    const api = workspaces.createApi({ window: { setTimeout: callback => callback() }, $: () => ({ length: 0 }),
        selectJsonFile: async () => ({ name: 'synthetic.json', text: '{}' }),
        apiPostJson: async (_url, data) => { calls.push(data.action); return data.action === 'preview' ? { summary } : response; },
        swal: (options, callback) => { if (callback) confirm = callback; else notices.push(options); },
        showToastMessage: options => notices.push(options), showError: (...args) => errors.push(args),
        claimAdvancedOperationLock: type => { calls.push('lock:' + type); return true; },
        releaseAdvancedOperationLock: type => calls.push('unlock:' + type),
        refreshType: async type => { calls.push('refresh:' + type); return refresh(type); },
        refreshBackups: async type => { calls.push('backups:' + type); return backupsRefresh(type); }, refreshThemeWorkspace: async () => { calls.push('theme'); return themeRefresh(); } });
    return { calls, notices, errors, apply: async () => { await api.importEnvironmentSnapshot(); return confirm(true); } };
};

test('environment import requires authoritative verified apply before publishing success', async () => {
    for (const response of [{}, { import: {} }, { import: { summary, verified: false } }]) {
        const f = fixture(response);
        await assert.rejects(f.apply(), /verification/i);
        assert.equal(f.notices.length, 0);
        assert.equal(f.errors.length, 1);
        assert.equal(f.calls.some(value => value.startsWith('refresh:')), false);
        assert.deepEqual(f.calls.slice(-2), ['unlock:vm', 'unlock:docker']);
    }
});

for (const mode of ['degraded', 'rejected']) {
    test(`committed environment import reports ${mode} refresh as a saved-state warning`, async () => {
        const f = fixture({ import: { summary, verified: true } }, async () => {
            if (mode === 'rejected') throw new Error('Synthetic refresh failure');
            return { hasErrors: true };
        });
        await f.apply();
        assert.equal(f.errors.length, 0, 'committed data must not be reported as an import failure');
        assert.ok(f.notices.some(notice => notice.level === 'warning'));
        assert.ok(f.notices.every(notice => notice.type !== 'success' && notice.level !== 'success'));
        assert.match(f.notices.at(-1).message, /saved|applied/i);
        assert.deepEqual(f.calls.slice(-2), ['unlock:vm', 'unlock:docker']);
    });
}

test('verified environment import with refreshed views preserves success and lock release', async () => {
    const f = fixture({ import: { summary, verified: true, rollback: { name: 'synthetic-checkpoint' } } });
    await f.apply();
    assert.equal(f.errors.length, 0);
    assert.ok(f.notices.some(notice => notice.level === 'success'));
    assert.ok(f.notices.some(notice => String(notice.message).includes('synthetic-checkpoint')));
    assert.ok(f.calls.includes('refresh:docker') && f.calls.includes('refresh:vm') && f.calls.includes('theme'));
    assert.deepEqual(f.calls.slice(-2), ['unlock:vm', 'unlock:docker']);
});

test('a theme refresh failure after verified import also stays a saved-state warning', async () => {
    const f = fixture({ import: { summary, verified: true } }, undefined, async () => { throw new Error('Synthetic theme refresh failure'); });
    await f.apply();
    assert.equal(f.errors.length, 0);
    assert.ok(f.notices.some(notice => notice.level === 'warning'));
    assert.ok(f.notices.every(notice => notice.level !== 'success' && notice.type !== 'success'));
    assert.deepEqual(f.calls.slice(-2), ['unlock:vm', 'unlock:docker']);
});

for (const failedType of ['docker', 'vm']) {
    test(`a false ${failedType} backup refresh result after verified import reports saved-state warning`, async () => {
        const f = fixture({ import: { summary, verified: true } }, undefined, undefined, async type => type !== failedType);
        await f.apply();
        assert.equal(f.errors.length, 0);
        assert.ok(f.notices.some(notice => notice.level === 'warning'));
        assert.ok(f.notices.every(notice => notice.level !== 'success' && notice.type !== 'success'));
        assert.deepEqual(f.calls.slice(-2), ['unlock:vm', 'unlock:docker']);
    });
}
