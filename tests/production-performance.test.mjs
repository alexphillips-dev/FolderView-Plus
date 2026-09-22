import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createProductionPerfFixture } from '../scripts/lib/production-perf-fixture.mjs';
import { median, checkMetric, dockerStartupStages, dockerStartupMetrics, checkDockerMembership } from '../scripts/lib/production-perf-metrics.mjs';
import { classifyPaths } from '../scripts/classify_ci_changes.mjs';

test('production benchmark rejects missing samples and enforces absolute and baseline limits', () => {
    for (const values of [[], [undefined], [NaN], [-1], [1, Infinity]]) assert.throws(() => median(values));
    assert.equal(median([9,1,5]), 5);
    assert.equal(median([9,1]), 5);
    const policy = { percent: 20, floor: 10 };
    assert.equal(checkMetric(120, 200, 100, policy).passed, true);
    assert.equal(checkMetric(121, 200, 100, policy).passed, false);
    assert.equal(checkMetric(201, 200, undefined, policy).passed, false);
    assert.throws(() => checkMetric(undefined, 200, 100, policy));
});

test('Docker timings fail closed and the representative workload preserves nesting and ownership', () => {
    assert.throws(() => dockerStartupMetrics({ operations: {} }), /Missing Docker startup stage/);
    const operations = Object.fromEntries(dockerStartupStages.map(stage => [stage, { lastMs: 1 }]));
    assert.equal(Object.keys(dockerStartupMetrics({ operations })).length, dockerStartupStages.length);
    operations.folderRows.lastMs = NaN;
    assert.throws(() => dockerStartupMetrics({ operations }), /folderRows/);
    const fixture = createProductionPerfFixture(process.cwd(), { folders: 23, nestedFolders: 7, members: 51 });
    const folders = Object.entries(fixture.folders);
    assert.equal(folders.filter(([,f]) => f.parentId).length, 7);
    assert.equal(folders.filter(([,f]) => !f.parentId).length, 16);
    assert.ok(folders.every(([,f]) => !f.parentId || fixture.folders[f.parentId]));
    const rows = folders.flatMap(([folderId,f]) => f.containers.map(name => ({ name, folderId })));
    assert.equal(checkDockerMembership(rows, fixture.folders, fixture.names), true);
    assert.equal(checkDockerMembership(rows.slice(1), fixture.folders, fixture.names), false);
    assert.equal(checkDockerMembership([rows[0], ...rows.slice(0,-1)], fixture.folders, fixture.names), false);
    rows[0].folderId = 'wrong-folder';
    assert.equal(checkDockerMembership(rows, fixture.folders, fixture.names), false);
});

test('production fixture derives Settings dependencies and markup from shipped source and isolates APIs', async () => {
    const fixture = createProductionPerfFixture(process.cwd(), { folders: 25, members: 50 }, 'de');
    await new Promise(resolve => fixture.server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${fixture.server.address().port}`;
    try {
        assert.equal(Object.keys(fixture.folders).length, 25);
        assert.equal(new Set(Object.values(fixture.folders).flatMap(folder => folder.containers)).size, 50);
        const dockerHtml = await fetch(origin+'/docker').then(r=>r.text());
        const rowIds = [...dockerHtml.matchAll(/id="ct-([a-f0-9]+)"/g)].map(match=>match[1]);
        assert.equal(rowIds.length, 50);
        assert.equal(new Set(rowIds).size, 50, 'Native host rows need unique short container IDs');
        const html = await fetch(origin+'/settings').then(r=>r.text());
        assert.match(html, /fvplus-settings-loader-manifest/);
        assert.match(html, /folderviewplus\.settings-loader\.js/);
        assert.match(html, /langs\/namespaces\/de\/legacy-surface\.json/);
        assert.doesNotMatch(html, /<\?php|runtime-performance\.fixture/);
        assert.ok(fixture.manifest.workspace.at(-1).includes('/folderviewplus.js'));
        const asset = await fetch(origin + fixture.manifest.workspace.at(-1));
        assert.match(asset.headers.get('cache-control'), /max-age=3600/);
        const response = await fetch(origin+'/plugins/folderview.plus/server/runtime_snapshot.php?type=all&mode=config');
        assert.equal(response.headers.get('cache-control'), 'no-store');
        assert.equal(Object.keys((await response.json()).snapshots.docker.folders).length, 25);
        assert.equal((await fetch(origin+'/plugins/folderview.plus/server/unmodeled.php')).status, 404);
        assert.equal((await fetch(origin+'/plugins/folderview.plus/server/backup_list.php')).status, 404, 'Unmodeled PHP must not be served as successful static content');
    } finally { await new Promise(resolve=>fixture.server.close(resolve)); }
});

test('standard performance command includes the production startup stage with reviewed baseline coverage', () => {
    for (const file of ['scripts/production_performance_benchmarks.mjs', 'scripts/production_perf_baseline.json',
        'scripts/production_perf_budgets.json', 'scripts/lib/production-perf-fixture.mjs', 'scripts/lib/production-perf-metrics.mjs']) {
        assert.equal(classifyPaths([file]).outputs.needs_browser, true, file);
    }
    const runner = fs.readFileSync('scripts/runtime_performance_benchmarks.mjs','utf8');
    assert.match(runner, /await runProductionPerformance/);
    const config = JSON.parse(fs.readFileSync('scripts/production_perf_budgets.json'));
    const baseline = JSON.parse(fs.readFileSync('scripts/production_perf_baseline.json'));
    for (const name of Object.keys(config.scenarios)) for (const surface of config.scenarios[name].surfaces || ['settings','docker']) for (const cache of ['cold','warm']) {
        const entry = baseline.cases[`${name}/${surface}/${cache}`];
        assert.deepEqual(entry.scenario, config.scenarios[name]);
        for (const metric of Object.keys({ ...config.budgets, ...config.caseBudgets?.[`${name}/${surface}`] })) assert.ok(Number.isFinite(entry.medians[metric]), metric);
    }
});
