import test from 'node:test';
import assert from 'node:assert/strict';
import { collectHostedAssetReport, investigationRefs, isBudgetAsset, requireHosted, signedComparison } from '../scripts/diagnose_static_assets.mjs';

const hosted = { GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'alexphillips-dev/FolderView-Plus', GITHUB_EVENT_NAME: 'workflow_dispatch' };
test('static asset investigation refuses workspace or untrusted invocations before any reader is called', () => {
    let reads = 0;
    for (const env of [{}, { ...hosted, GITHUB_ACTIONS: 'false' }, { ...hosted, GITHUB_REPOSITORY: 'other/repository' }, { ...hosted, GITHUB_EVENT_NAME: 'push' }]) {
        assert.throws(() => collectHostedAssetReport({ env, loadSnapshot: () => { reads++; } }));
    }
    assert.equal(reads, 0);
    assert.doesNotThrow(() => requireHosted(hosted));
});
test('static asset selection mirrors the guard without including vendored libraries or unrelated source', () => {
    const prefix = 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/';
    for (const name of ['scripts/folderviewplus.js', 'styles/folderviewplus.css', 'scripts/include-extra.js']) assert.equal(isBudgetAsset(prefix + name), true);
    for (const name of ['scripts/include/vendor.js', 'server/read.php', 'langs/en.json']) assert.equal(isBudgetAsset(prefix + name), false);
    assert.equal(isBudgetAsset('tests/browser/fixture.js'), false);
});
test('synthetic report keeps signed removals and additions and compares only fixed reviewed commits', () => {
    // Supplied fixture counters only: no Git reads, asset reads or compression run in this test.
    const before = { commit: 'before', assets: { 'scripts/old.js': { bytes: 10, gzipBytes: 4 } },
        totals: { totalJs: 10, totalCss: 0, totalJsGzip: 4, totalCssGzip: 0 } };
    const after = { commit: 'after', assets: { 'styles/new.css': { bytes: 7, gzipBytes: 3 } },
        totals: { totalJs: 0, totalCss: 7, totalJsGzip: 0, totalCssGzip: 3 } };
    const delta = signedComparison(before, after);
    assert.deepEqual(delta.totals, { totalJs: -10, totalCss: 7, totalJsGzip: -4, totalCssGzip: 3 });
    assert.equal(delta.assets['scripts/old.js'].status, 'removed');
    assert.equal(delta.assets['styles/new.css'].status, 'added');
    const refs = [];
    const report = collectHostedAssetReport({ env: hosted, loadSnapshot: commit => { refs.push(commit); return { ...before, commit }; } });
    assert.deepEqual(refs, Object.values(investigationRefs));
    assert.equal(report.comparisons.neoraid.before, investigationRefs.beforeNeoraid);
    assert.equal(report.comparisons.engineOwnership.after, investigationRefs.engine);
    assert.equal(report.method.baselineChanged, false);
    assert.equal(report.method.thresholdsChanged, false);
});
