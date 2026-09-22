import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createProductionPerfFixture } from './lib/production-perf-fixture.mjs';
import { median, checkMetric, observeProductionStartup, dockerStartupMetrics, checkDockerMembership } from './lib/production-perf-metrics.mjs';

export const runProductionPerformance = async ({ updateBaseline = false, scenarioName = '' } = {}) => {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const config = JSON.parse(fs.readFileSync(path.join(root, 'scripts/production_perf_budgets.json')));
    if (scenarioName && !config.scenarios[scenarioName]) throw new Error(`Unknown scenario: ${scenarioName}`);
    const baselinePath = path.join(root, 'scripts/production_perf_baseline.json');
    const baseline = fs.existsSync(baselinePath) ? JSON.parse(fs.readFileSync(baselinePath)) : null;
    if (!baseline && !updateBaseline) throw new Error('Production startup baseline is missing');
    const report = { version: 1, generatedAt: new Date().toISOString(), measuredRuns: config.measuredRuns,
        limitations: 'Synthetic Unraid host and APIs; shipped plugin JavaScript, CSS, markup and locale catalogs. Host widget stubs do not model Unraid server execution time.',
        cases: {}, failures: [] };
    const browser = await chromium.launch({ args: ['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'] });
    report.browser = browser.version();
    try {
        for (const [name, scenario] of Object.entries(config.scenarios)) {
            if (scenarioName && name !== scenarioName) continue;
            const fixture = createProductionPerfFixture(root, scenario, scenario.locale);
            await new Promise(resolve => fixture.server.listen(0, '127.0.0.1', resolve));
            const origin = `http://127.0.0.1:${fixture.server.address().port}`;
            try {
                for (const surface of scenario.surfaces || ['settings', 'docker']) {
                    const samples = { cold: [], warm: [] };
                    for (let run = 0; run < config.measuredRuns; run++) {
                        const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
                        try {
                            await context.addInitScript(observeProductionStartup);
                            const page = await context.newPage();
                            page.setDefaultNavigationTimeout(60000);
                            for (const temperature of ['cold', 'warm']) {
                                console.log(`[production-perf] measuring ${name}/${surface}/${temperature} ${run + 1}/${config.measuredRuns}`);
                                const deadline = setTimeout(() => context.close().catch(() => {}), 120000);
                                const errors = [], consoleErrors = [];
                                const onError = error => errors.push(error.message);
                                const onResponse = response => { if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${new URL(response.url()).pathname}`); };
                                const onRequest = request => { if (!request.url().startsWith(origin + '/')) errors.push('Non-fixture network request'); };
                                const onConsole = message => { if (message.type() === 'error') consoleErrors.push(message.text()); };
                                page.on('pageerror', onError); page.on('response', onResponse); page.on('request', onRequest); page.on('console', onConsole);
                                try {
                                    await page.goto(`${origin}/${surface}`, { waitUntil: 'load' });
                                    await page.waitForFunction(({ surface, count }) => {
                                        const state = window.FolderViewPlusSettingsBootstrapState;
                                        const ready = surface === 'settings' ? state?.ready === true && state.failed !== true && state.degraded !== true
                                            && document.querySelectorAll('#docker_folders tr[data-folder-id], #docker-folders tr[data-folder-id], tr[data-folder-id]').length === count
                                            : document.querySelectorAll('#docker_list tr.folder').length === count;
                                        const localized = window.FolderViewPlusI18n?.snapshot().initialized === true;
                                        if (ready && localized) window.productionPerf.state.readyMs ||= performance.now();
                                        return ready && localized;
                                    }, { surface, count: scenario.folders }, { timeout: 100000 });
                                    if (surface === 'settings') await page.evaluate(() => window.FolderViewPlusSettingsRuntimeHydrationPromise);
                                    await page.evaluate(() => window.FolderViewPlusI18n.ready);
                                    // Fixed post-ready observation window includes deferred hydration and layout work.
                                    await page.waitForTimeout(config.observationMs);
                                    const result = await page.evaluate(() => ({ ...window.productionPerf.finish(),
                                        nativeRowIds: [...document.querySelectorAll('#docker_containers tr[id^="ct-"]')].map(row => row.id),
                                        membership: [...document.querySelectorAll('#docker_containers tr[id^="ct-"]')].map(row => ({ name: row.dataset.name, folderId: row.closest('tr.folder')?.dataset.fvFolderId })),
                                        folderDepths: [...document.querySelectorAll('#docker_list tr.folder')].map(row => ({ id: row.dataset.fvFolderId, depth: Number(row.dataset.folderDepth), parentId: row.dataset.folderParent || '' })),
                                        localeErrors: window.FolderViewPlusI18n.snapshot().loadErrors,
                                        missingKeys: window.FolderViewPlusI18n.snapshot().recentMissingKeys }));
                                    if (surface === 'docker') {
                                        result.startupTiming = await page.evaluate(() => window.FolderViewPlusRuntimePerformanceTelemetry.getSnapshot('docker'));
                                        Object.assign(result, dockerStartupMetrics(result.startupTiming));
                                        if (!checkDockerMembership(result.membership, fixture.folders, fixture.names)) errors.push('Native member assignment changed');
                                        if (result.folderDepths.length !== scenario.folders || result.folderDepths.some(row => row.depth !== (fixture.folders[row.id]?.parentId ? 1 : 0) || row.parentId !== (fixture.folders[row.id]?.parentId || ''))) errors.push('Folder hierarchy changed');
                                        if (scenario.nestedFolders) {
                                            const interaction = await page.evaluate(() => {
                                                const originals = [...document.querySelectorAll('#docker_containers tr[id^="ct-"]')];
                                                const button = document.querySelector('.dropDown-fixture-folder-0');
                                                const centered = [...document.querySelectorAll('#docker_list > tr.folder > td.folder-name > .folder-name-sub')].every(node => node.style.top === '50%');
                                                window.dropDownButton('fixture-folder-0', false);
                                                const expanded = button.getAttribute('active') === 'true';
                                                window.dropDownButton('fixture-folder-0', false);
                                                return centered && expanded && button.getAttribute('active') === 'false' && originals.every(node => node.isConnected);
                                            });
                                            if (!interaction) errors.push('Folder centering or expand/collapse changed');
                                        }
                                    }
                                    const knownErrors = consoleErrors.filter(message => config.knownConsoleErrors.some(known => message.includes(known)));
                                    errors.push(...consoleErrors.filter(message => !config.knownConsoleErrors.some(known => message.includes(known))));
                                    if (knownErrors.length > (surface === 'settings' ? config.maxKnownConsoleErrors : 0)) errors.push('Known console error count increased');
                                    if (result.localeErrors.length || result.missingKeys.some(key => surface !== 'settings' || !config.knownMissingKeys.includes(key))) errors.push(`Localization failed: ${JSON.stringify({ loads: result.localeErrors, missing: result.missingKeys })}`);
                                    if (surface === 'docker' && (result.nativeRowIds.length !== scenario.members || new Set(result.nativeRowIds).size !== scenario.members)) errors.push('Native member rows were lost or duplicated');
                                    if (!result.scripts.some(file => file.endsWith(surface === 'settings' ? '/folderviewplus.js' : '/docker.js'))) errors.push('Production entry point was not loaded');
                                    if (surface === 'settings' && !fixture.manifest.workspace.every(url => result.scripts.includes(url.split('?')[0]))) errors.push('Settings workspace modules were skipped');
                                    if (temperature === 'warm' && result.cachedScriptRequests < result.scriptRequests / 2) errors.push('Warm navigation did not reuse the browser script cache');
                                    if (errors.length) { report.failedSample = { key: `${name}/${surface}/${temperature}`, result, errors }; throw new Error(`${name}/${surface}/${temperature}: ${errors.join('\n')}`); }
                                    result.knownConsoleErrors = knownErrors.map(message => message.split('\n')[0]);
                                    samples[temperature].push(result);
                                } finally {
                                    clearTimeout(deadline);
                                    page.off('pageerror', onError); page.off('response', onResponse); page.off('request', onRequest); page.off('console', onConsole);
                                }
                            }
                        } finally { await context.close(); }
                    }
                    for (const temperature of ['cold', 'warm']) {
                        const key = `${name}/${surface}/${temperature}`, checks = {}, medians = {};
                        const budgets = { ...config.budgets, ...config.caseBudgets?.[`${name}/${surface}`] };
                        for (const [metric, budget] of Object.entries(budgets)) {
                            const value = median(samples[temperature].map(sample => sample[metric]));
                            const policy = metric.endsWith('Ms') ? config.timingPolicy : config.countPolicy;
                            medians[metric] = Math.round(value*100)/100;
                            const previous = baseline?.cases?.[key]?.medians?.[metric];
                            if (!updateBaseline && !Number.isFinite(previous)) throw new Error(`Baseline is missing ${key}.${metric}`);
                            checks[metric] = checkMetric(value, budget, updateBaseline ? undefined : previous, policy);
                            if (!checks[metric].passed) report.failures.push(`${key}.${metric}: ${value} > ${checks[metric].limit}`);
                        }
                        report.cases[key] = { scenario, medians, checks, samples: samples[temperature] };
                        console.log(`[production-perf] ${key}: ready=${medians.readyMs}ms, longestTask=${medians.longestTaskMs}ms, scripts=${medians.scriptRequests}`);
                    }
                }
            } finally { await new Promise(resolve => fixture.server.close(resolve)); }
        }
    } catch (error) { report.failures.push(error.stack || String(error)); }
    finally { await browser.close(); }
    const artifactDir = path.join(root, 'tmp/fixture-browser-artifacts/production-performance');
    fs.mkdirSync(artifactDir, { recursive: true });
    fs.writeFileSync(path.join(artifactDir, 'report.json'), JSON.stringify(report, null, 2)+'\n');
    const stageRows = Object.entries(report.cases).filter(([key]) => key.startsWith('representative/'))
        .flatMap(([key, entry]) => Object.entries(entry.medians).filter(([metric]) => Object.hasOwn(config.caseBudgets['representative/docker'], metric)).map(([metric, value]) => `| ${key} | ${metric} | ${value} |`));
    fs.writeFileSync(path.join(artifactDir, 'docker-stages.md'), '# Representative Docker startup\n\nMilliseconds; medians of three measurements per cache condition.\n\n| Case | Metric | ms |\n|---|---|---:|\n'+stageRows.join('\n')+'\n');
    const knownIssues = [...new Set(Object.values(report.cases).flatMap(entry => entry.samples.flatMap(sample => [
        ...sample.knownConsoleErrors, ...sample.missingKeys.map(key => `Missing translation: ${key}`)
    ])))];
    fs.writeFileSync(path.join(artifactDir, 'report.md'), '# Production startup benchmark\n\n'+report.limitations+'\n\n| Case | Ready ms | Longest task ms | Requests |\n|---|---:|---:|---:|\n'+Object.entries(report.cases).map(([key,c])=>`| ${key} | ${c.medians.readyMs} | ${c.medians.longestTaskMs} | ${c.medians.requests} |`).join('\n')+'\n\n## Existing issues recorded\n\n'+knownIssues.map(issue=>`- ${issue}`).join('\n')+'\n\n## Budget failures\n\n'+(report.failures.join('\n') || 'None')+'\n');
    if (report.failures.length) throw new Error(report.failures.join('\n'));
    if (updateBaseline) fs.writeFileSync(baselinePath, JSON.stringify({ version: 1, browser: report.browser,
        generatedAt: report.generatedAt, cases: { ...(scenarioName ? baseline?.cases : {}), ...Object.fromEntries(Object.entries(report.cases).map(([key,value])=>[key,{ scenario: value.scenario, medians: value.medians }])) } }, null, 2)+'\n');
    console.log('Production startup performance budgets passed.');
    return report;
};
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await runProductionPerformance({ updateBaseline: process.argv.includes('--update-baseline'), scenarioName: process.argv.find(arg => arg.startsWith('--scenario='))?.slice(11) || '' });
