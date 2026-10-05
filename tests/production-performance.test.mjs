import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createProductionPerfFixture } from '../scripts/lib/production-perf-fixture.mjs';
import { readProductionBaseline, selectProductionPerfSurfaces, runProductionPerformance } from '../scripts/production_performance_benchmarks.mjs';
import { median, checkMetric, dockerStartupStages, dockerStartupMetrics, checkDockerMembership, observeProductionStartup } from '../scripts/lib/production-perf-metrics.mjs';
import { classifyPaths } from '../scripts/classify_ci_changes.mjs';

test('production startup selection respects changed surfaces without suppressing component coverage', async () => {
    assert.deepEqual(selectProductionPerfSurfaces({}, false, 'settings'), ['settings']);
    assert.deepEqual(selectProductionPerfSurfaces({}, false, 'docker'), ['docker']);
    assert.deepEqual(selectProductionPerfSurfaces({}, false, 'settings,docker'), ['settings', 'docker']);
    assert.deepEqual(selectProductionPerfSurfaces({ surfaces: ['settings'] }, false, 'docker'), []);
    assert.deepEqual(selectProductionPerfSurfaces({}, true, 'settings,docker'), ['settings']);
    assert.deepEqual(selectProductionPerfSurfaces({}, false, 'none'), []);
    assert.throws(() => selectProductionPerfSurfaces({}, false, 'unknown'), /Unknown/);
    const previous = process.env.FVPLUS_PRODUCTION_PERF_SURFACES;
    process.env.FVPLUS_PRODUCTION_PERF_SURFACES = 'none';
    try {
        const report = await runProductionPerformance();
        assert.deepEqual(report.cases, {});
        assert.deepEqual(report.skippedSurfaces, ['settings', 'docker']);
        await assert.rejects(runProductionPerformance({ updateBaseline: true }), /without startup samples/);
    } finally {
        if (previous === undefined) delete process.env.FVPLUS_PRODUCTION_PERF_SURFACES;
        else process.env.FVPLUS_PRODUCTION_PERF_SURFACES = previous;
    }
});

test('Settings readiness records the actual transition before delayed browser polling', () => {
    let clock = 0, rows = 2;
    const listeners = new Map();
    let localized = false;
    const window = { FolderViewPlusI18n: { snapshot: () => ({ initialized: localized, readyAt: new Date(60).toISOString() }) } };
    const context = vm.createContext({ window, document: {
        querySelectorAll: () => ({ length: rows }), addEventListener: (name, callback) => listeners.set(name, callback)
    }, performance: { now: () => clock, timeOrigin: 0 }, Number, Math, Date,
    PerformanceObserver: class { observe() {} }, MutationObserver: class { observe() {} }, requestAnimationFrame() {} });
    vm.runInContext(`(${observeProductionStartup.toString()})({folderCount:2})`, context);
    window.FolderViewPlusMarkSettingsBootstrapState = state => state;
    window.FolderViewPlusMarkSettingsBootstrapState({ ready: true, degraded: true });
    assert.equal(window.productionPerf.state.readyMs, undefined);
    rows = 1;
    window.FolderViewPlusMarkSettingsBootstrapState({ ready: true });
    clock = 60;
    localized = true;
    listeners.get('folderviewplus:i18n-ready')();
    assert.equal(window.productionPerf.state.readyMs, undefined, 'Wrong row count cannot mark readiness');
    rows = 2;
    window.FolderViewPlusMarkSettingsBootstrapState({ ready: true });
    assert.equal(window.productionPerf.state.readyMs, 60);
    clock = 1400;
    window.FolderViewPlusMarkSettingsBootstrapState({ ready: true });
    assert.equal(window.productionPerf.state.readyMs, 60, 'Deferred work cannot inflate the timestamp');
    const state = window.productionPerf.state;
    delete state.readyMs; delete state.localeReadyMs;
    // Catalog initialization happened at 60ms; its DOM translation event can be later.
    listeners.get('folderviewplus:i18n-ready')();
    assert.equal(state.readyMs, 60, 'The late translation event must use the initialization timestamp');
});

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

test('baseline reads distinguish a missing file from invalid data and other read errors', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-baseline-read-'));
    const file = path.join(root, 'baseline.json');
    try {
        assert.equal(readProductionBaseline(file), null);
        fs.writeFileSync(file, JSON.stringify({ version: 1, cases: {} }));
        assert.deepEqual(readProductionBaseline(file), { version: 1, cases: {} });
        fs.writeFileSync(file, 'invalid JSON');
        assert.throws(() => readProductionBaseline(file), SyntaxError);
        assert.throws(() => readProductionBaseline(root));
    } finally { fs.rmSync(root, { recursive: true }); }
});

test('production fixture returns 404 for missing, removed, and directory assets and stays usable', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-fixture-assets-'));
    const pluginPath = 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus';
    const plugin = path.join(root, pluginPath);
    fs.mkdirSync(plugin, { recursive: true });
    fs.copyFileSync(path.join(process.cwd(), pluginPath, 'FolderViewPlus.page'), path.join(plugin, 'FolderViewPlus.page'));
    const file = path.join(plugin, 'fixture.js');
    fs.writeFileSync(file, 'fixture asset');
    fs.mkdirSync(path.join(plugin, 'directory.json'));
    const fixture = createProductionPerfFixture(root, { folders: 1, members: 1 });
    await new Promise(resolve => fixture.server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${fixture.server.address().port}/plugins/folderview.plus/`;
    try {
        const response = await fetch(origin + 'fixture.js');
        assert.equal(response.status, 200);
        assert.equal(await response.text(), 'fixture asset');
        fs.rmSync(file);
        for (const name of ['fixture.js', 'missing.js', 'directory.json', 'missing/child.js']) {
            assert.equal((await fetch(origin + name)).status, 404, name);
        }
        fs.writeFileSync(file, 'replacement asset');
        assert.equal(await fetch(origin + 'fixture.js').then(result => result.text()), 'replacement asset');
    } finally {
        await new Promise(resolve => fixture.server.close(resolve));
        fs.rmSync(root, { recursive: true });
    }
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
