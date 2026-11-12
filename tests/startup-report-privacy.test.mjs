import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = fs.readFileSync('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.fatal-banner.js', 'utf8');
const secrets = ['PrivateVMOrchid', 'PrivateFolderCedar', 'SecretTokenMint', '/private/project', 'private.example'];
const detail = `${secrets[0]} ${secrets[1]} https://${secrets[4]}${secrets[3]}?token=${secrets[2]}`;
const createHarness = () => {
    const copied = [];
    const downloads = [];
    const document = {
        getElementById: () => null,
        body: { appendChild() {} },
        createElement: () => ({ style: {}, click() {}, remove() {} })
    };
    const window = {
        document, location: { href: `https://${secrets[4]}${secrets[3]}` },
        navigator: { userAgent: detail, clipboard: { writeText: async text => copied.push(text) } },
        addEventListener() {}, setTimeout: callback => callback(), Blob,
        URL: { createObjectURL: blob => { downloads.push(blob); return 'blob:fixture'; }, revokeObjectURL() {} }
    };
    vm.runInNewContext(source, { window, URL, Blob });
    return { api: window.FolderViewPlusFatalBanner, copied, downloads };
};
const populate = api => {
    api.setEnvironment({ page: 'Settings', pluginVersion: '2026.11.04.01', unraidVersion: '7.3.2', channel: 'dev' });
    api.setPrefsStatus({ fetched: true, normalized: false, sourceType: 'docker', normalizeError: detail, fallbackUsed: true });
    api.markStep(detail);
    api.recordAction(detail);
    api.recordModuleEvent({ name: detail, stage: detail, outcome: 'failed', detail, version: detail, durationMs: 42 });
    api.recordRequest({ method: 'GET', url: detail, outcome: 'error', status: '503', traceId: detail, source: detail, category: 'server-error', detail, responseSnippet: detail });
    api.captureIncident({ code: 'FVPLUS-SET-LOADER-001', category: 'missing-asset', phase: detail, userMessage: detail, details: [detail] });
};
const assertPrivate = text => secrets.forEach(secret => assert.equal(text.includes(secret), false, `leaked ${secret}`));

test('startup default report, copy and download redact free-form values without later modules', async () => {
    const { api, copied, downloads } = createHarness();
    populate(api);
    const report = api.buildSupportReport();
    assertPrivate(report);
    assert.match(report, /errorCode: FVPLUS-SET-LOADER-001/);
    assert.match(report, /category: missing-asset/);
    assert.match(report, /pluginVersion: 2026\.11\.04\.01/);
    assert.match(report, /status=503/);
    assert.match(report, /durationMs=42/);
    assert.match(report, /fetched: yes/);
    assert.match(report, /fallbackUsed: yes/);
    assert.equal(await api.copyDiagnostics(), true);
    assert.equal(api.downloadDiagnostics(), true);
    assertPrivate(copied[0]);
    assertPrivate(await downloads[0].text());
});

test('startup sanitized report treats metadata as untrusted while full mode remains explicit', () => {
    const { api } = createHarness();
    populate(api);
    api.setEnvironment({ page: detail, channel: detail, pluginVersion: detail, unraidVersion: detail });
    api.setPrefsStatus({ sourceType: detail, rawSchemaVersion: detail, normalizedSchemaVersion: detail });
    api.setModuleStatus(detail, detail, detail);
    api.recordRequest({ method: detail, outcome: detail, status: detail, url: detail });
    const issue = { incidentId: detail, code: detail, phase: detail, severity: detail, category: detail, firstSeenAt: detail, lastSeenAt: detail, message: detail, details: [detail] };
    assertPrivate(api.buildSupportReport(issue));
    assertPrivate(api.buildSupportReport(issue, { privacy: 'unexpected' }));
    const full = api.buildSupportReport(issue, { privacy: 'full' });
    secrets.forEach(secret => assert.ok(full.includes(secret), `full mode lost ${secret}`));
    assert.match(full, /privacyMode: full/);
});
