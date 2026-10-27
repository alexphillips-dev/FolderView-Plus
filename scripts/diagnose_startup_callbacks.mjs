import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { createProductionPerfFixture } from './lib/production-perf-fixture.mjs';
import { checkDockerMembership, median, observeProductionStartup } from './lib/production-perf-metrics.mjs';

export const requireHostedInvestigation = (env = process.env) => {
    assert.equal(env.GITHUB_ACTIONS, 'true', 'Callback investigation requires GitHub Actions; workspace execution is disabled.');
};

export const combineRulesResponse = (engine, consumer) => (pathname, body) => {
    if (pathname.endsWith('/folderviewplus.utils-rules.js')) return engine + '\n;\n' + consumer;
    if (pathname !== '/docker') return body;
    const tag = /<script\b[^>]*src="[^"\n]*\/folderviewplus\.rules-engine\.js(?:\?[^"\n]*)?"[^>]*><\/script>/g;
    assert.equal([...String(body).matchAll(tag)].length, 1, 'Control requires exactly one rules-engine asset');
    assert.ok(String(body).includes('/folderviewplus.utils-rules.js'), 'Control requires the rules consumer');
    return String(body).replace(tag, '');
};

export async function investigateStartupCallbacks() {
    requireHostedInvestigation();
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const plugin = path.join(root, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts');
    const engine = fs.readFileSync(path.join(plugin, 'folderviewplus.rules-engine.js'), 'utf8');
    const consumer = fs.readFileSync(path.join(plugin, 'folderviewplus.utils-rules.js'), 'utf8');
    const config = JSON.parse(fs.readFileSync(path.join(root, 'scripts/production_perf_budgets.json')));
    const report = { commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
        engineSha256: crypto.createHash('sha256').update(engine).digest('hex'),
        consumerSha256: crypto.createHash('sha256').update(consumer).digest('hex'), cases: {} };
    const browser = await chromium.launch({ args: ['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'] });
    report.browser = browser.version();
    try {
        for (const name of ['representative', 'small', 'normal']) {
            const scenario = config.scenarios[name];
            assert.ok(scenario.members <= 500);
            const samples = { separate: [], combined: [] };
            for (let run = 0; run < 3; run++) {
                for (const variant of run % 2 ? ['combined', 'separate'] : ['separate', 'combined']) {
                    const fixture = createProductionPerfFixture(root, scenario, scenario.locale,
                        variant === 'combined' ? { transformResponse: combineRulesResponse(engine, consumer) } : {});
                    await new Promise(resolve => fixture.server.listen(0, '127.0.0.1', resolve));
                    const origin = `http://127.0.0.1:${fixture.server.address().port}`;
                    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
                    const deadline = setTimeout(() => context.close().catch(() => {}), 120000);
                    try {
                        await context.addInitScript(observeProductionStartup, { folderCount: scenario.folders });
                        const page = await context.newPage(), errors = [];
                        page.on('pageerror', error => errors.push(error.message));
                        page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
                        page.on('response', response => { if (response.status() >= 400) errors.push(`HTTP ${response.status()}`); });
                        page.on('request', request => { if (!request.url().startsWith(origin + '/')) errors.push('Non-fixture request'); });
                        await page.goto(origin + '/docker', { waitUntil: 'load', timeout: 60000 });
                        await page.waitForFunction(count => document.querySelectorAll('#docker_list tr.folder').length === count
                            && window.FolderViewPlusI18n?.snapshot().initialized === true, scenario.folders, { timeout: 100000 });
                        await page.evaluate(() => window.FolderViewPlusI18n.ready);
                        await page.waitForTimeout(config.observationMs);
                        const result = await page.evaluate(() => ({ ...window.productionPerf.finish(),
                            membership: [...document.querySelectorAll('#docker_containers tr[id^="ct-"]')]
                                .map(row => ({ name: row.dataset.name, folderId: row.closest('tr.folder')?.dataset.fvFolderId })),
                            locale: window.FolderViewPlusI18n.snapshot() }));
                        assert.deepEqual(errors, []);
                        assert.ok(checkDockerMembership(result.membership, fixture.folders, fixture.names));
                        assert.deepEqual(result.locale.loadErrors, []);
                        assert.deepEqual(result.locale.recentMissingKeys, []);
                        samples[variant].push({ mutationCallbacks: result.mutationCallbacks, mutationRecords: result.mutationRecords,
                            domNodes: result.domNodes, scriptRequests: result.scriptRequests });
                        console.log(`[callback-investigation] ${name}/${variant}/${run + 1}: ${result.mutationCallbacks} callbacks, ${result.mutationRecords} records`);
                    } finally {
                        clearTimeout(deadline);
                        await context.close();
                        await new Promise(resolve => fixture.server.close(resolve));
                    }
                }
            }
            const medians = Object.fromEntries(Object.entries(samples).map(([variant, values]) =>
                [variant, Object.fromEntries(Object.keys(values[0]).map(metric => [metric, median(values.map(value => value[metric]))]))]));
            report.cases[name] = { scenario, samples, medians,
                callbackDelta: medians.separate.mutationCallbacks - medians.combined.mutationCallbacks };
        }
    } finally {
        await browser.close();
        const output = path.join(root, 'tmp/fixture-browser-artifacts/callback-investigation.json');
        fs.mkdirSync(path.dirname(output), { recursive: true });
        fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
    }
    return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await investigateStartupCallbacks();
