import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const scripts = 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/';
const activitySource = fs.readFileSync(scripts + 'folderviewplus.activity-diagnostics.js', 'utf8');
const telemetrySource = fs.readFileSync(scripts + 'folderviewplus.support-bundle-telemetry.js', 'utf8');
const secrets = ['SyntheticPrivateHost', 'SyntheticSecret', 'SyntheticVm', 'SyntheticPath'];
const createHarness = (collector = 'missing') => {
    const downloads = [], errors = [], clipboard = [];
    const document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {} };
    const location = { href: 'https://SyntheticPrivateHost/Settings?token=SyntheticSecret', pathname: '/Settings' };
    const navigator = { clipboard: { writeText: async text => clipboard.push(text) } };
    const window = { document, location, navigator, addEventListener() {},
        downloadFile: (_name, text) => downloads.push(JSON.parse(text)), showError: (...args) => errors.push(args) };
    if (collector === 'partial') window.FolderViewPlusSupportBundleTelemetry = { createApi: () => ({}) };
    const context = vm.createContext({ window, globalThis: window, document, location, navigator, URL, console,
        setTimeout: () => 0, clearTimeout() {}, $: () => ({ length: 0 }), prefsByType: {}, fatalBanner: null,
        getEffectiveThemeCompatibilityMode: () => 'auto',
        apiGetJson: async url => ({ ok: true, bundle: {
            bundleMeta: { privacyMode: new URL(url, 'https://fixture.invalid').searchParams.get('privacy') },
            pluginState: { docker: { counts: { folders: 3 } } },
            healthAndHistory: { summary: { issueCount: 2 } }
        } }), apiPostText: async () => {}, describeTrackedEvent: () => '' });
    if (collector === 'healthy') vm.runInContext(telemetrySource, context);
    vm.runInContext(activitySource, context);
    const api = window.FolderViewPlusDiagnostics;
    api.recordRequestErrorTelemetry('GET', '/private/SyntheticPath?token=SyntheticSecret', new Error('SyntheticVm rejected SyntheticSecret'));
    return { api, downloads, errors, clipboard };
};

for (const collector of ['missing', 'partial']) {
    test(`sanitized diagnostics exports omit raw browser data when telemetry is ${collector}`, async () => {
        const fixture = createHarness(collector);
        await fixture.api.exportSupportBundleByMode();
        await fixture.api.exportDiagnosticsByMode();
        await fixture.api.copyIssueReport();
        assert.equal(fixture.downloads.length, 2);
        assert.equal(fixture.clipboard.length, 1);
        assert.deepEqual(fixture.errors, []);
        for (const payload of fixture.downloads) {
            assert.equal(payload.bundleMeta.privacyMode, 'sanitized');
            assert.equal(payload.pluginState.docker.counts.folders, 3);
            assert.equal(payload.healthAndHistory.summary.issueCount, 2);
            assert.deepEqual(payload.uiTelemetry, {});
        }
        for (const secret of secrets) {
            assert.equal(JSON.stringify(fixture.downloads).includes(secret), false, secret);
            assert.equal(fixture.clipboard[0].includes(secret), false, secret);
        }
        assert.equal(fixture.api.getRequestErrorDiagnosticsSnapshot().last.message, 'SyntheticVm rejected SyntheticSecret');
    });
}

test('explicit full diagnostics retains browser evidence when the telemetry module is missing', async () => {
    const fixture = createHarness();
    await fixture.api.exportSupportBundleByMode('full');
    assert.equal(fixture.downloads.length, 1);
    assert.equal(fixture.downloads[0].bundleMeta.privacyMode, 'full');
    for (const secret of secrets) assert.equal(JSON.stringify(fixture.downloads[0]).includes(secret), true);
    assert.deepEqual(fixture.errors, []);
});

test('healthy telemetry keeps the established redactor and browser section for sanitized exports', async () => {
    const fixture = createHarness('healthy');
    await fixture.api.exportSupportBundleByMode();
    assert.equal(fixture.downloads.length, 1);
    assert.ok(fixture.downloads[0].uiTelemetry.requestErrors);
    assert.ok(fixture.downloads[0].redactionManifest.privacySelfCheck);
    assert.deepEqual(fixture.errors, []);
    assert.equal(JSON.stringify(fixture.downloads[0]).includes('https://SyntheticPrivateHost/Settings?token=SyntheticSecret'), false);
});
