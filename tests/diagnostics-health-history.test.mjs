import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const modulePath = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.activity-diagnostics.js');
const source = fs.readFileSync(modulePath, 'utf8');
const snapshot = (privacyMode, marker) => ({ privacyMode, marker, recentTimeline: [] });
const createHarness = () => {
    const requests = [], errors = [], statuses = [];
    const document = {
        readyState: 'loading', addEventListener() {},
        getElementById: () => null, querySelector: () => null, querySelectorAll: () => []
    };
    const window = { document, location: { pathname: '/Settings/FolderViewPlus' }, showError: (...args) => errors.push(args) };
    const context = vm.createContext({
        window, document, console, setTimeout: () => 0, clearTimeout() {},
        $: () => ({ length: 0 }), prefsByType: {}, advancedModuleStatusByKey: {}, activityFeedEntries: [],
        getEffectiveThemeCompatibilityMode: () => 'auto',
        markAdvancedModuleLoadSuccess: (key) => statuses.push([key, 'success']),
        markAdvancedModuleLoadError: (key) => statuses.push([key, 'error']),
        refreshType: async () => {}, refreshBackups: async () => {},
        apiGetJson: (url) => new Promise((resolve, reject) => requests.push({ url, resolve, reject })),
        apiPostJson: (url, body) => new Promise((resolve, reject) => requests.push({ url, body, resolve, reject }))
    });
    vm.runInContext(source, context, { filename: modulePath });
    return { api: window.FolderViewPlusDiagnostics, requests, errors, statuses };
};

test('automatic history hydration requests named on-screen diagnostics on every refresh', async () => {
    const { api, requests, errors } = createHarness();
    for (let index = 0; index < 2; index += 1) {
        const pending = api.refreshChangeHistory({ quiet: true });
        const request = requests.at(-1);
        const privacy = new URL(request.url, 'http://fixture.invalid').searchParams.get('privacy');
        request.resolve({ ok: true, diagnostics: snapshot(privacy, index) });
        assert.equal(await pending, true);
        assert.equal(api.getCachedDiagnostics().privacyMode, 'full');
        assert.equal(api.getCachedDiagnostics().marker, index);
    }
    assert.deepEqual(errors, []);
});

test('a late history response cannot overwrite a completed health check', async () => {
    const { api, requests, errors } = createHarness();
    const history = api.refreshChangeHistory({ quiet: true });
    const health = api.runDiagnostics();
    const checked = snapshot('full', 'new-health');
    requests[1].resolve({ ok: true, diagnostics: checked });
    await health;
    requests[0].resolve({ ok: true, diagnostics: snapshot('sanitized', 'old-history') });
    assert.equal(await history, true);
    assert.equal(api.getCachedDiagnostics(), checked);
    assert.deepEqual(errors, []);
});

test('history cannot populate the health cards while an explicit check is pending', async () => {
    const { api, requests, errors } = createHarness();
    const checked = snapshot('full', 'previous-health');
    api.renderDiagnostics(checked);
    const health = api.runDiagnostics();
    const history = api.refreshChangeHistory({ quiet: true });
    requests[1].resolve({ ok: true, diagnostics: snapshot('full', 'background-history') });
    assert.equal(await history, true);
    assert.equal(api.getCachedDiagnostics(), checked);
    requests[0].resolve({ ok: true, diagnostics: snapshot('full', 'new-health') });
    await health;
    assert.equal(api.getCachedDiagnostics().marker, 'new-health');
    assert.deepEqual(errors, []);
});

test('a late history response cannot restore pre-repair health findings', async () => {
    const { api, requests, errors } = createHarness();
    const history = api.refreshChangeHistory({ quiet: true });
    const repair = api.repairDiagnostics('repair_orphaned_members', 'vm');
    assert.equal(requests[1].body.type, 'vm');
    const repaired = snapshot('full', 'repaired');
    requests[1].resolve({ ok: true, diagnostics: repaired });
    await repair;
    requests[0].resolve({ ok: true, diagnostics: snapshot('full', 'before-repair') });
    assert.equal(await history, true);
    assert.equal(api.getCachedDiagnostics(), repaired);
    assert.deepEqual(errors, []);
});

test('failed history refresh preserves health findings and default exports stay sanitized', async () => {
    const { api, requests, statuses } = createHarness();
    const checked = snapshot('full', 'private-fixture-name');
    api.renderDiagnostics(checked);
    const history = api.refreshChangeHistory({ quiet: true });
    requests[0].reject(new Error('Synthetic history failure'));
    assert.equal(await history, false);
    assert.equal(api.getCachedDiagnostics(), checked);
    assert.deepEqual(statuses, [['change_history', 'error']]);
    const exported = api.getSupportBundle();
    assert.match(requests[1].url, /action=support_bundle&privacy=sanitized$/);
    requests[1].resolve({ ok: true, bundle: { bundleMeta: { privacyMode: 'sanitized' } } });
    assert.doesNotMatch(JSON.stringify(await exported), /private-fixture-name/);
});
