import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const repoRoot = path.resolve(process.cwd());
const diagnosticsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.activity-diagnostics.js'
);
const diagnosticsSource = fs.readFileSync(diagnosticsPath, 'utf8');

const loadDiagnosticsApi = () => {
    const window = {};
    const document = {
        readyState: 'loading',
        addEventListener() {}
    };
    const context = vm.createContext({
        window,
        document,
        console,
        location: { href: 'http://localhost/Settings/FolderViewPlus' },
        navigator: {},
        localStorage: { getItem: () => null },
        $: () => ({ length: 0 })
    });
    vm.runInContext(diagnosticsSource, context, { filename: diagnosticsPath });
    return window.FolderViewPlusDiagnostics;
};

test('cold and isolated performance samples remain observations until warm overruns repeat', () => {
    const api = loadDiagnosticsApi();
    const now = Date.now();
    const coldOnly = api.summarizePerformanceDiagnosticsSamples([
        { at: now, durationMs: 5293, details: { coldLoad: true } }
    ], 2500);
    assert.equal(coldOnly.overBudget, false);
    assert.equal(coldOnly.evaluation, 'observed');
    assert.equal(coldOnly.coldLoadCount, 1);
    assert.equal(coldOnly.warmSampleCount, 0);

    const isolatedWarm = api.summarizePerformanceDiagnosticsSamples([
        { at: now - 1000, durationMs: 3000, details: { coldLoad: false } }
    ], 2500);
    assert.equal(isolatedWarm.overBudget, false);
    assert.equal(isolatedWarm.evaluation, 'observed');

    const repeatedWarm = api.summarizePerformanceDiagnosticsSamples([
        { at: now - 2000, durationMs: 3000, details: { coldLoad: false } },
        { at: now - 1000, durationMs: 3100, details: { coldLoad: false } }
    ], 2500);
    assert.equal(repeatedWarm.overBudget, true);
    assert.equal(repeatedWarm.repeatedOverBudget, true);
    assert.equal(repeatedWarm.recentOverBudgetCount, 2);
});

test('one extreme warm sample requests follow-up and samples outside the evaluation window expire', () => {
    const api = loadDiagnosticsApi();
    const now = Date.now();
    const extremeWarm = api.summarizePerformanceDiagnosticsSamples([
        { at: now, durationMs: 7600, details: { coldLoad: false } }
    ], 2500);
    assert.equal(extremeWarm.overBudget, true);
    assert.equal(extremeWarm.extremeOverBudget, true);

    const expired = api.summarizePerformanceDiagnosticsSamples([
        { at: now - (31 * 60 * 1000), durationMs: 7600, details: { coldLoad: false } }
    ], 2500);
    assert.equal(expired, null);
});

test('health summary separates core, advisory, and optional card lanes', () => {
    assert.match(diagnosticsSource, /const coreCards =/);
    assert.match(diagnosticsSource, /advisoryCards: performanceCard \? \[performanceCard\] : \[\]/);
    assert.match(diagnosticsSource, /buildLocalizationDiagnosticsSummaryCard\(\)/);
    assert.match(diagnosticsSource, /buildNativeOrganizerDiagnosticsSummaryCard\(diagnostics\)/);
    assert.match(diagnosticsSource, /diagnosticsViewModelModule\.buildDiagnosticsViewModel\(\{/);
});
