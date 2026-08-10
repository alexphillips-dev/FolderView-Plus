import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const scriptPath = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(scriptPath), '..');
const pluginDir = path.join(rootDir, 'src', 'folderview.plus', 'usr', 'local', 'emhttp', 'plugins', 'folderview.plus');
const fixtureDir = path.join(rootDir, 'tests', 'browser', 'fixtures');
const budgetPath = path.join(rootDir, 'scripts', 'runtime_perf_budgets.json');
const baselinePath = path.join(rootDir, 'scripts', 'runtime_perf_baseline.json');
const artifactDir = path.resolve(process.env.FVPLUS_RUNTIME_PERF_ARTIFACT_DIR || path.join(rootDir, 'tmp', 'fixture-browser-artifacts', 'runtime-performance'));
const updateBaseline = process.argv.includes('--update-baseline');
const budgetConfig = JSON.parse(fs.readFileSync(budgetPath, 'utf8'));
const requestedRuns = Number(process.env.FVPLUS_RUNTIME_PERF_REPETITIONS);
const measuredRuns = Math.max(3, Number.isFinite(requestedRuns) ? requestedRuns : Number(budgetConfig.runs?.measured || 5));
const warmupRuns = Math.max(1, Number(budgetConfig.runs?.warmup || 1));
const timeoutMs = Math.max(15000, Number(process.env.FVPLUS_RUNTIME_PERF_TIMEOUT_MS) || 90000);
let atomicWriteCounter = 0;
const writeFileAtomic = (targetPath, content) => {
    const resolvedTarget = path.resolve(targetPath);
    const parent = path.dirname(resolvedTarget);
    fs.mkdirSync(parent, { recursive: true });
    atomicWriteCounter += 1;
    const temporaryPath = path.join(parent, `.${path.basename(resolvedTarget)}.${process.pid}.${atomicWriteCounter}.tmp`);
    const descriptor = fs.openSync(temporaryPath, 'wx', 0o600);
    try {
        fs.writeFileSync(descriptor, content, 'utf8');
        fs.fsyncSync(descriptor);
    } finally {
        fs.closeSync(descriptor);
    }
    fs.renameSync(temporaryPath, resolvedTarget);
};

const mimeTypes = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8'
};
const safeResolve = (base, relativePath) => {
    const resolvedBase = path.resolve(base);
    const resolved = path.resolve(resolvedBase, String(relativePath || '').replace(/^[/\\]+/, ''));
    return resolved === resolvedBase || resolved.startsWith(`${resolvedBase}${path.sep}`) ? resolved : '';
};
const server = http.createServer((request, response) => {
    try {
        const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
        const fixtureRoutes = {
            '/performance/runtime': 'performance-runtime.html',
            '/performance/settings': 'performance-settings.html',
            '/performance/editor': 'performance-folder-editor.html'
        };
        let filePath = fixtureRoutes[requestUrl.pathname]
            ? path.join(fixtureDir, fixtureRoutes[requestUrl.pathname])
            : '';
        if (requestUrl.pathname.startsWith('/plugin/')) filePath = safeResolve(pluginDir, requestUrl.pathname.slice('/plugin/'.length));
        if (requestUrl.pathname.startsWith('/fixtures/')) filePath = safeResolve(fixtureDir, requestUrl.pathname.slice('/fixtures/'.length));
        if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
            response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            response.end('Not found');
            return;
        }
        response.writeHead(200, {
            'Content-Type': mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
            'Cache-Control': 'no-store'
        });
        fs.createReadStream(filePath).pipe(response);
    } catch (error) {
        console.error('Runtime performance fixture request failed:', error);
        response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Internal fixture server error');
    }
});

const median = (values) => {
    const sorted = values.filter(Number.isFinite).slice().sort((left, right) => left - right);
    if (!sorted.length) return 0;
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const roundMetric = (value) => Math.round(Number(value || 0) * 100) / 100;
const metricKinds = {
    nativeRowsVisibleMs: 'timing',
    allFoldersGroupedMs: 'timing',
    settingsBootstrapMs: 'timing',
    folderEditorOpenMs: 'timing',
    incrementalStartStopMs: 'timing',
    updateAllReconciliationMs: 'timing',
    domNodeCount: 'count',
    mutationObserverCallbacks: 'count',
    heapGrowthBytes: 'heap',
    bootstrapNetworkRequests: 'count'
};

const collectPage = async (context, url, surface) => {
    const page = await context.newPage();
    page.setDefaultTimeout(timeoutMs);
    let requestCount = 0;
    page.on('request', (request) => {
        if (request.url().startsWith(url.split('/performance/')[0])) requestCount += 1;
    });
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => Boolean(window.FolderViewPlusPerformanceFixture));
    await page.evaluate(() => window.FolderViewPlusPerformanceFixture.ready);
    let snapshot;
    if (surface === 'runtime') {
        snapshot = await page.evaluate(() => window.FolderViewPlusPerformanceFixture.runLifecycleBenchmarks());
        await page.evaluate(() => globalThis.gc?.());
        const heapBefore = await page.evaluate(() => Number(performance.memory?.usedJSHeapSize || 0));
        await page.evaluate(() => window.FolderViewPlusPerformanceFixture.switchViews(30));
        await page.evaluate(() => globalThis.gc?.());
        const heapAfter = await page.evaluate(() => Number(performance.memory?.usedJSHeapSize || 0));
        snapshot = await page.evaluate(() => window.FolderViewPlusPerformanceFixture.snapshot());
        snapshot.heapGrowthBytes = Math.max(0, heapAfter - heapBefore);
        snapshot.bootstrapNetworkRequests = requestCount;
    } else {
        snapshot = await page.evaluate(() => window.FolderViewPlusPerformanceFixture.snapshot());
    }
    await page.close();
    return snapshot;
};

const collectScenario = async (browser, baseUrl, scenario) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const query = `folders=${scenario.folders}&members=${scenario.members}`;
    try {
        const runtime = await collectPage(context, `${baseUrl}/performance/runtime?${query}`, 'runtime');
        const settings = await collectPage(context, `${baseUrl}/performance/settings?${query}`, 'settings');
        const editor = await collectPage(context, `${baseUrl}/performance/editor?${query}`, 'editor');
        return {
            nativeRowsVisibleMs: runtime.nativeRowsVisibleMs,
            allFoldersGroupedMs: runtime.allFoldersGroupedMs,
            settingsBootstrapMs: settings.settingsBootstrapMs,
            folderEditorOpenMs: editor.folderEditorOpenMs,
            incrementalStartStopMs: runtime.incrementalStartStopMs,
            updateAllReconciliationMs: runtime.updateAllReconciliationMs,
            domNodeCount: Math.max(runtime.domNodeCount, settings.domNodeCount, editor.domNodeCount),
            mutationObserverCallbacks: runtime.mutationObserverCallbacks,
            mutationRecordCount: runtime.mutationRecordCount,
            heapGrowthBytes: runtime.heapGrowthBytes,
            bootstrapNetworkRequests: runtime.bootstrapNetworkRequests
        };
    } finally {
        await context.close();
    }
};

const baseline = fs.existsSync(baselinePath) ? JSON.parse(fs.readFileSync(baselinePath, 'utf8')) : null;
if (!baseline && !updateBaseline) throw new Error('Runtime performance baseline is missing. Run with --update-baseline and review the result.');
fs.mkdirSync(artifactDir, { recursive: true });
await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
});
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
    headless: true,
    args: ['--enable-precise-memory-info', '--js-flags=--expose-gc']
});

const report = {
    version: 1,
    generatedAt: new Date().toISOString(),
    browser: await browser.version(),
    measuredRuns,
    warmupRuns,
    scenarios: {},
    failures: []
};
try {
    for (const [name, scenario] of Object.entries(budgetConfig.scenarios || {})) {
        for (let index = 0; index < warmupRuns; index += 1) await collectScenario(browser, baseUrl, scenario);
        const samples = [];
        for (let index = 0; index < measuredRuns; index += 1) samples.push(await collectScenario(browser, baseUrl, scenario));
        const medians = {};
        for (const metric of Object.keys(metricKinds)) medians[metric] = roundMetric(median(samples.map((sample) => Number(sample[metric] || 0))));
        medians.mutationRecordCount = roundMetric(median(samples.map((sample) => Number(sample.mutationRecordCount || 0))));
        const checks = {};
        for (const [metric, kind] of Object.entries(metricKinds)) {
            const absoluteBudget = Number(scenario.budgets?.[metric]);
            const baselineValue = Number(baseline?.scenarios?.[name]?.medians?.[metric]);
            let regressionLimit = Number.POSITIVE_INFINITY;
            if (Number.isFinite(baselineValue)) {
                if (kind === 'timing') {
                    const metricNoiseFloor = Number(budgetConfig.regressionPolicy?.timingNoiseFloorMsByMetric?.[metric]);
                    const timingNoiseFloor = Number.isFinite(metricNoiseFloor)
                        ? metricNoiseFloor
                        : Number(budgetConfig.regressionPolicy?.timingNoiseFloorMs || 15);
                    regressionLimit = baselineValue + Math.max(
                        baselineValue * Number(budgetConfig.regressionPolicy?.timingPercent || 60) / 100,
                        timingNoiseFloor
                    );
                } else if (kind === 'heap') {
                    regressionLimit = baselineValue + Math.max(
                        baselineValue * Number(budgetConfig.regressionPolicy?.heapPercent || 75) / 100,
                        Number(budgetConfig.regressionPolicy?.heapNoiseFloorBytes || 4194304)
                    );
                } else {
                    const countFloor = metric === 'domNodeCount' ? 100 : 1;
                    regressionLimit = baselineValue + Math.max(
                        baselineValue * Number(budgetConfig.regressionPolicy?.countPercent || 15) / 100,
                        countFloor
                    );
                }
            }
            const effectiveLimit = Math.min(absoluteBudget, regressionLimit);
            const passed = medians[metric] <= effectiveLimit;
            checks[metric] = {
                value: medians[metric],
                absoluteBudget,
                baseline: Number.isFinite(baselineValue) ? baselineValue : null,
                effectiveLimit: roundMetric(effectiveLimit),
                passed
            };
            if (!passed) report.failures.push(`${name}.${metric}: ${medians[metric]} exceeded ${roundMetric(effectiveLimit)}`);
        }
        report.scenarios[name] = {
            folders: scenario.folders,
            members: scenario.members,
            medians,
            samples,
            checks
        };
    }
} finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
}

if (updateBaseline) {
    const nextBaseline = {
        version: 1,
        generatedAt: report.generatedAt,
        browser: report.browser,
        notes: 'Tracked medians for the deterministic Chromium runtime fixtures. Update only after reviewing an intentional performance change.',
        scenarios: Object.fromEntries(Object.entries(report.scenarios).map(([name, value]) => [name, {
            folders: value.folders,
            members: value.members,
            medians: value.medians
        }]))
    };
    writeFileAtomic(baselinePath, `${JSON.stringify(nextBaseline, null, 2)}\n`);
    report.failures = [];
}

const jsonPath = path.join(artifactDir, 'runtime-performance-report.json');
const markdownPath = path.join(artifactDir, 'runtime-performance-report.md');
writeFileAtomic(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
const rows = [];
for (const [name, scenario] of Object.entries(report.scenarios)) {
    for (const metric of Object.keys(metricKinds)) {
        const check = scenario.checks[metric];
        rows.push(`| ${name} | ${metric} | ${check.value} | ${check.effectiveLimit} | ${check.passed ? 'Pass' : 'Fail'} |`);
    }
}
writeFileAtomic(markdownPath, `# Runtime performance budget report\n\nChromium ${report.browser}; ${measuredRuns} measured runs after ${warmupRuns} warm-up. Values are medians.\n\n| Scenario | Metric | Median | Limit | Result |\n| --- | --- | ---: | ---: | --- |\n${rows.join('\n')}\n`);

for (const [name, scenario] of Object.entries(report.scenarios)) {
    const summary = Object.entries(scenario.medians).map(([metric, value]) => `${metric}=${value}`).join(', ');
    console.log(`[runtime-perf] ${name} (${scenario.folders}/${scenario.members}): ${summary}`);
}
console.log(`[runtime-perf] report: ${path.relative(rootDir, jsonPath)}`);
if (report.failures.length) {
    report.failures.forEach((failure) => console.error(`ERROR: Runtime performance regression: ${failure}`));
    process.exitCode = 1;
} else {
    console.log('Runtime performance budgets passed.');
}
