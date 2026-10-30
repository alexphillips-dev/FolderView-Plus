import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { createProductionPerfFixture } from './lib/production-perf-fixture.mjs';
import { checkDockerMembership, median, observeProductionStartup } from './lib/production-perf-metrics.mjs';

const prefix = '/plugins/folderview.plus/scripts/';
const precedingAsset = prefix + 'docker.runtime.providers.js';
const integrationAsset = prefix + 'docker.runtime.api-integration.js';
const metrics = ['mutationCallbacks', 'mutationRecords', 'domNodes', 'requests', 'scriptRequests', 'cachedScriptRequests'];

export const requireHostedInvestigation = (env = process.env) => {
    assert.equal(env.GITHUB_ACTIONS, 'true', 'Callback investigation requires GitHub Actions; workspace execution is disabled.');
    assert.equal(env.GITHUB_REPOSITORY, 'alexphillips-dev/FolderView-Plus', 'Unexpected investigation repository.');
    assert.equal(env.GITHUB_EVENT_NAME, 'workflow_dispatch', 'Callback investigation requires explicit hosted dispatch.');
};

// Keep both original asset bodies and their execution order. Only the separate
// parser-blocking script element/request is removed from the synthetic response.
export const combineIntegrationResponse = (preceding, integration) => {
    const combined = Buffer.concat([Buffer.from(preceding), Buffer.from('\n;\n'), Buffer.from(integration)]);
    return (pathname, body) => {
        if (pathname === precedingAsset) return combined;
        if (pathname !== '/docker') return body;
        const html = String(body);
        const integrationTag = /<script\b[^>]*src="[^"\n]*\/docker\.runtime\.api-integration\.js(?:\?[^"\n]*)?"[^>]*><\/script>/g;
        const precedingTag = /<script\b[^>]*src="[^"\n]*\/docker\.runtime\.providers\.js(?:\?[^"\n]*)?"[^>]*><\/script>/g;
        const tags = [...html.matchAll(integrationTag)], predecessors = [...html.matchAll(precedingTag)];
        assert.equal(tags.length, 1, 'Control requires exactly one API integration asset');
        assert.equal(predecessors.length, 1, 'Control requires exactly one preceding providers asset');
        const end = predecessors[0].index + predecessors[0][0].length;
        assert.ok(end <= tags[0].index && html.slice(end, tags[0].index).trim() === '',
            'Control requires the providers asset immediately before API integration');
        return html.replace(integrationTag, '');
    };
};

export const validateStartupSample = (result, fixture, { temperature, variant, locale }) => {
    assert.deepEqual(result.errors, [], 'Startup produced a page, console, HTTP, or external request error');
    assert.ok(checkDockerMembership(result.membership, fixture.folders, fixture.names), 'Native member assignment changed');
    assert.equal(result.nativeRowIds.length, fixture.names.length, 'Native rows were lost');
    assert.equal(new Set(result.nativeRowIds).size, fixture.names.length, 'Native rows were duplicated');
    assert.equal(result.folderDepths.length, Object.keys(fixture.folders).length, 'Folder rows were lost');
    assert.equal(new Set(result.folderDepths.map(row => row.id)).size, Object.keys(fixture.folders).length, 'Folder rows were duplicated');
    assert.ok(result.folderDepths.every(row => fixture.folders[row.id]
        && row.depth === (fixture.folders[row.id].parentId ? 1 : 0)
        && row.parentId === (fixture.folders[row.id].parentId || '')), 'Folder hierarchy changed');
    assert.equal(result.locale.initialized, true);
    assert.equal(result.locale.resolvedLocale, locale);
    assert.equal(result.locale.direction, locale === 'ar' ? 'rtl' : 'ltr');
    assert.deepEqual(result.locale.loadErrors, []);
    assert.deepEqual(result.locale.recentMissingKeys, []);
    assert.ok(result.scripts.some(file => file.endsWith('/docker.js')), 'Production Docker entry was not loaded');
    assert.equal(result.scripts.filter(file => file === precedingAsset).length, 1);
    assert.equal(result.scripts.filter(file => file === integrationAsset).length, variant === 'separate' ? 1 : 0);
    if (temperature === 'warm') assert.ok(result.cachedScriptRequests >= result.scriptRequests / 2, 'Warm navigation did not reuse the browser script cache');
    for (const metric of metrics) assert.ok(Number.isFinite(result[metric]) && result[metric] >= 0, `Missing or invalid ${metric}`);
};

export async function investigateStartupCallbacks({ env = process.env } = {}) {
    // Reject workspace/untrusted invocations before asset reads or browser launch.
    requireHostedInvestigation(env);
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const scripts = path.join(root, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts');
    const preceding = fs.readFileSync(path.join(scripts, path.basename(precedingAsset)));
    const integration = fs.readFileSync(path.join(scripts, path.basename(integrationAsset)));
    const config = JSON.parse(fs.readFileSync(path.join(root, 'scripts/production_perf_budgets.json')));
    const report = { version: 1, generatedAt: new Date().toISOString(),
        commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
        runId: env.GITHUB_RUN_ID, runAttempt: env.GITHUB_RUN_ATTEMPT,
        limitations: 'Hosted synthetic Docker startup only; no baseline changes, release qualification, or live Unraid measurements.',
        measuredPairs: 3, observationMs: config.observationMs,
        precedingAsset, integrationAsset,
        precedingSha256: crypto.createHash('sha256').update(preceding).digest('hex'),
        integrationSha256: crypto.createHash('sha256').update(integration).digest('hex'), cases: {} };
    const browser = await chromium.launch({ args: ['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'] });
    report.browser = browser.version();
    try {
        for (const name of ['normal', 'rtl']) {
            const scenario = config.scenarios[name];
            assert.ok(scenario.members <= 500, 'Investigation is capped at 500 resources');
            for (const temperature of ['cold', 'warm']) report.cases[`${name}/docker/${temperature}`] = {
                scenario, samples: { separate: [], combined: [] }
            };
            for (let run = 0; run < report.measuredPairs; run++) {
                for (const variant of run % 2 ? ['combined', 'separate'] : ['separate', 'combined']) {
                    const fixture = createProductionPerfFixture(root, scenario, scenario.locale,
                        variant === 'combined' ? { transformResponse: combineIntegrationResponse(preceding, integration) } : {});
                    await new Promise(resolve => fixture.server.listen(0, '127.0.0.1', resolve));
                    const origin = `http://127.0.0.1:${fixture.server.address().port}`;
                    let context;
                    try {
                        context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
                        await context.addInitScript(observeProductionStartup, { folderCount: scenario.folders });
                        const page = await context.newPage();
                        for (const temperature of ['cold', 'warm']) {
                            const key = `${name}/docker/${temperature}`, errors = [];
                            const onError = error => errors.push(error.message);
                            const onConsole = message => { if (message.type() === 'error') errors.push(message.text()); };
                            const onResponse = response => { if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${new URL(response.url()).pathname}`); };
                            const onRequest = request => { if (!request.url().startsWith(origin + '/')) errors.push('Non-fixture request'); };
                            page.on('pageerror', onError); page.on('console', onConsole); page.on('response', onResponse); page.on('request', onRequest);
                            const deadline = setTimeout(() => context.close().catch(() => {}), 120000);
                            try {
                                await page.goto(origin + '/docker', { waitUntil: 'load', timeout: 60000 });
                                await page.waitForFunction(count => document.querySelectorAll('#docker_list tr.folder').length === count
                                    && window.FolderViewPlusI18n?.snapshot().initialized === true, scenario.folders, { timeout: 100000 });
                                await page.evaluate(() => window.FolderViewPlusI18n.ready);
                                await page.waitForTimeout(config.observationMs);
                                const result = await page.evaluate(() => ({ ...window.productionPerf.finish(),
                                    nativeRowIds: [...document.querySelectorAll('#docker_containers tr[id^="ct-"]')].map(row => row.id),
                                    membership: [...document.querySelectorAll('#docker_containers tr[id^="ct-"]')]
                                        .map(row => ({ name: row.dataset.name, folderId: row.closest('tr.folder')?.dataset.fvFolderId })),
                                    folderDepths: [...document.querySelectorAll('#docker_list tr.folder')]
                                        .map(row => ({ id: row.dataset.fvFolderId, depth: Number(row.dataset.folderDepth), parentId: row.dataset.folderParent || '' })),
                                    locale: window.FolderViewPlusI18n.snapshot() }));
                                result.errors = errors;
                                try { validateStartupSample(result, fixture, { temperature, variant, locale: scenario.locale }); }
                                catch (error) { report.failedSample = { key, variant, pair: run + 1, result }; throw error; }
                                report.cases[key].samples[variant].push({ pair: run + 1,
                                    ...Object.fromEntries(metrics.map(metric => [metric, result[metric]])),
                                    validation: { membership: true, hierarchy: true, localization: true, noErrors: true,
                                        nativeRows: result.nativeRowIds.length, folders: result.folderDepths.length } });
                                console.log(`[callback-investigation] ${key}/${variant}/${run + 1}: ${result.mutationCallbacks} callbacks, ${result.mutationRecords} records, ${result.requests} requests`);
                            } finally {
                                clearTimeout(deadline);
                                page.off('pageerror', onError); page.off('console', onConsole); page.off('response', onResponse); page.off('request', onRequest);
                            }
                        }
                    } finally {
                        try { await context?.close(); }
                        finally { await new Promise(resolve => fixture.server.close(resolve)); }
                    }
                }
            }
        }
        for (const entry of Object.values(report.cases)) {
            entry.medians = Object.fromEntries(Object.entries(entry.samples).map(([variant, values]) => {
                assert.equal(values.length, report.measuredPairs, 'Incomplete paired investigation');
                return [variant, Object.fromEntries(metrics.map(metric => [metric, median(values.map(value => value[metric]))]))];
            }));
            entry.deltas = Object.fromEntries(metrics.map(metric => [metric, entry.medians.separate[metric] - entry.medians.combined[metric]]));
            assert.equal(entry.deltas.scriptRequests, 1, 'Control must remove exactly one script request');
            entry.callbackDelta = entry.deltas.mutationCallbacks;
        }
        report.completed = true;
    } catch (error) {
        report.failure = error.stack || String(error);
        throw error;
    } finally {
        await browser.close();
        const output = path.join(root, 'tmp/fixture-browser-artifacts/callback-investigation.json');
        fs.mkdirSync(path.dirname(output), { recursive: true });
        fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
    }
    return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await investigateStartupCallbacks();
