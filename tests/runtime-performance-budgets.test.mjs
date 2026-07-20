import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const readJson = (relativePath) => JSON.parse(read(relativePath));

const requiredMetrics = [
    'nativeRowsVisibleMs',
    'allFoldersGroupedMs',
    'settingsBootstrapMs',
    'folderEditorOpenMs',
    'incrementalStartStopMs',
    'updateAllReconciliationMs',
    'domNodeCount',
    'mutationObserverCallbacks',
    'heapGrowthBytes',
    'bootstrapNetworkRequests'
];

test('runtime performance matrix covers the required small, normal, and extreme installations', () => {
    const config = readJson('scripts/runtime_perf_budgets.json');
    const baseline = readJson('scripts/runtime_perf_baseline.json');
    const expectedScenarios = {
        small: [25, 50],
        normal: [100, 500],
        extreme: [250, 2000]
    };
    assert.equal(config.runs.measured, 5);
    assert.ok(config.runs.warmup >= 1);
    assert.equal(config.regressionPolicy.timingNoiseFloorMsByMetric.nativeRowsVisibleMs, 250);
    for (const [name, [folders, members]] of Object.entries(expectedScenarios)) {
        assert.equal(config.scenarios[name].folders, folders);
        assert.equal(config.scenarios[name].members, members);
        assert.equal(baseline.scenarios[name].folders, folders);
        assert.equal(baseline.scenarios[name].members, members);
        for (const metric of requiredMetrics) {
            assert.ok(Number.isFinite(config.scenarios[name].budgets[metric]), `${name}.${metric} must have an absolute budget`);
            assert.ok(Number.isFinite(baseline.scenarios[name].medians[metric]), `${name}.${metric} must have a tracked median`);
        }
    }
});

test('runtime benchmark enforces median regression limits with noise floors and review artifacts', () => {
    const runner = read('scripts/runtime_performance_benchmarks.mjs');
    assert.match(runner, /const median = \(values\)/);
    assert.match(runner, /timingNoiseFloorMs/);
    assert.match(runner, /timingNoiseFloorMsByMetric\?\.\[metric\]/);
    assert.match(runner, /Number\.isFinite\(metricNoiseFloor\)/);
    assert.match(runner, /heapNoiseFloorBytes/);
    assert.match(runner, /Math\.min\(absoluteBudget, regressionLimit\)/);
    assert.match(runner, /runtime-performance-report\.json/);
    assert.match(runner, /runtime-performance-report\.md/);
    assert.match(runner, /--update-baseline/);
});

test('runtime fixtures observe real browser DOM, lifecycle, view-switch, heap, and request work', () => {
    const fixture = read('tests/browser/fixtures/runtime-performance.fixture.js');
    const runner = read('scripts/runtime_performance_benchmarks.mjs');
    assert.match(fixture, /new MutationObserver/);
    assert.match(fixture, /root\.replaceChildren\(groupedFragment\)/);
    assert.match(fixture, /runLifecycleBenchmarks/);
    assert.match(fixture, /switchViews = async \(iterations = 30\)/);
    assert.match(runner, /--enable-precise-memory-info/);
    assert.match(runner, /performance\.memory\?\.usedJSHeapSize/);
    assert.match(runner, /page\.on\('request'/);
});

test('required fixture-browser CI lane runs the runtime performance budgets', () => {
    const suite = read('scripts/run_ci_suite.sh');
    const workflow = read('.github/workflows/ci.yml');
    assert.match(suite, /bash scripts\/runtime_performance_benchmarks\.sh/);
    assert.match(workflow, /--lane fixture-browser/);
    assert.match(workflow, /tmp\/fixture-browser-artifacts\/\*\*/);
});
