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
    assert.equal(listeners.length, 0, 'DOM readiness must not start Settings-dependent diagnostics');
});

test('activity diagnostics registers before optional startup rendering', () => {
    const markerIndex = source.indexOf('window.FolderViewPlusDiagnosticsModuleLoaded = true;');
    const startupIndex = source.indexOf('const initializeActivityDiagnosticsRuntime =');
    assert.ok(markerIndex >= 0, 'diagnostics module marker is missing');
    assert.ok(startupIndex > markerIndex, 'optional diagnostics rendering must run after module registration');
    assert.match(source, /^\(function folderViewPlusActivityDiagnosticsModule\(window, document\) \{/);
    assert.match(source, /if \(window\.FolderViewPlusDiagnosticsModuleLoaded === true\) \{\s*return;\s*\}/);
    assert.match(source, /\}\)\(window, document\);\s*$/);
});

for (const readyState of ['loading', 'interactive', 'complete']) {
    test(`diagnostics waits for Settings readiness and initializes once when DOM is ${readyState}`, () => {
        const errors = [];
        const documentListeners = [];
        const windowListeners = [];
        let queries = 0;
        const document = { readyState, addEventListener: (name) => documentListeners.push(name),
            getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] };
        const window = { document, location: { pathname: '/Settings/FolderViewPlus' },
            addEventListener: (name) => windowListeners.push(name),
            console: { error: (...args) => errors.push(args) }, showError: (...args) => errors.push(args) };
        const context = vm.createContext({ window, document, console: window.console });
        vm.runInContext(source, context);
        assert.deepEqual(errors, [], 'loading the module must not access absent Settings globals');
        assert.deepEqual(documentListeners, []);
        assert.deepEqual(windowListeners, ['pagehide']);
        context.$ = () => { queries++; return { length: 0 }; };
        context.prefsByType = { docker: {}, vm: {} };
        context.getEffectiveThemeCompatibilityMode = () => 'auto';
        window.FolderViewPlusDiagnostics.initialize();
        assert.deepEqual(errors, []);
        assert.deepEqual(documentListeners, ['visibilitychange']);
        assert.deepEqual(windowListeners, ['pagehide', 'storage']);
        assert.ok(queries > 0);
        const initializedQueries = queries;
        window.FolderViewPlusDiagnostics.initialize();
        vm.runInContext(source, context);
        window.FolderViewPlusDiagnostics.initialize();
        assert.equal(queries, initializedQueries, 'repeated initialization must not repeat rendering');
        assert.deepEqual(documentListeners, ['visibilitychange']);
        assert.deepEqual(windowListeners, ['pagehide', 'storage']);
        const settings = fs.readFileSync(path.join(path.dirname(modulePath), 'folderviewplus.js'), 'utf8');
        assert.match(settings, /settingsUiState\.initialized = true;\s*window\.FolderViewPlusDiagnostics\?\.initialize\?\.\(\);/);
    });
}

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
