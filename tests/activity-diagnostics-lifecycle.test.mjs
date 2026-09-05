import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const repoRoot = path.resolve(process.cwd());
const modulePath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.activity-diagnostics.js'
);
const source = fs.readFileSync(modulePath, 'utf8');

test('activity diagnostics is safe to evaluate repeatedly during Settings navigation', () => {
    const listeners = [];
    const document = {
        readyState: 'loading',
        addEventListener: (name, handler, options) => listeners.push({ name, handler, options })
    };
    const window = {
        document,
        console,
        setTimeout,
        clearTimeout
    };
    window.window = window;
    const context = vm.createContext({
        window,
        document,
        console,
        setTimeout,
        clearTimeout
    });

    vm.runInContext(source, context, { filename: modulePath });
    assert.equal(window.FolderViewPlusDiagnosticsModuleLoaded, true);
    assert.equal(typeof window.FolderViewPlusDiagnostics?.getDiagnostics, 'function');
    const diagnosticsApi = window.FolderViewPlusDiagnostics;

    assert.doesNotThrow(() => vm.runInContext(source, context, { filename: modulePath }));
    assert.equal(window.FolderViewPlusDiagnosticsModuleLoaded, true);
    assert.equal(window.FolderViewPlusDiagnostics, diagnosticsApi);
    assert.equal(listeners.filter(({ name }) => name === 'DOMContentLoaded').length, 1);
});

test('activity diagnostics registers before optional startup rendering', () => {
    const markerIndex = source.indexOf('window.FolderViewPlusDiagnosticsModuleLoaded = true;');
    const startupIndex = source.indexOf('initializeActivityDiagnosticsRuntime();');
    assert.ok(markerIndex >= 0, 'diagnostics module marker is missing');
    assert.ok(startupIndex > markerIndex, 'optional diagnostics rendering must run after module registration');
    assert.match(source, /^\(function folderViewPlusActivityDiagnosticsModule\(window, document\) \{/);
    assert.match(source, /if \(window\.FolderViewPlusDiagnosticsModuleLoaded === true\) \{\s*return;\s*\}/);
    assert.match(source, /\}\)\(window, document\);\s*$/);
});

test('full on-screen findings never replace sanitized preview or export summaries', async () => {
    let telemetryDeps;
    const requests = [];
    const document = { readyState: 'loading', addEventListener() {}, getElementById: () => null };
    const window = {
        document,
        FolderViewPlusSupportBundleTelemetry: { createApi(deps) {
            telemetryDeps = deps;
            return { collectSupportBundleUiTelemetry: (bundle) => bundle };
        } },
        FolderViewPlusSupportBundlePreview: { createApi(deps) {
            return { refreshSupportBundlePreview: async () => deps.enrichSupportBundlePreview({
                bundleMeta: { privacyMode: 'sanitized', previewOnly: true }, healthAndHistory: { summary: { totalIssues: 1 } }
            }) };
        } }
    };
    const context = vm.createContext({
        window, document, console,
        $: () => ({ length: 0 }),
        apiGetJson: async (url) => {
            requests.push(url);
            return { ok: true, bundle: { bundleMeta: { privacyMode: 'sanitized' }, healthAndHistory: { summary: { totalIssues: 1 } } } };
        }
    });
    vm.runInContext(source, context, { filename: modulePath });
    const api = window.FolderViewPlusDiagnostics;
    api.renderDiagnostics({ privacyMode: 'full', summary: { detail: 'private-folder-and-member' } });
    assert.equal(telemetryDeps.getDiagnosticsSummary(), null);
    const exported = await api.getSupportBundle();
    assert.match(requests[0], /action=support_bundle&privacy=sanitized$/);
    assert.doesNotMatch(JSON.stringify(exported), /private-folder-and-member/);
    api.renderDiagnostics({ privacyMode: 'sanitized', summary: { totalIssues: 1 } });
    assert.equal(telemetryDeps.getDiagnosticsSummary().totalIssues, 1);
});
