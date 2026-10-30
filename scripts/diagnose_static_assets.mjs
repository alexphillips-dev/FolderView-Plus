import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';

export const investigationRefs = Object.freeze({
    publishedMain: '5b17d3972773cf09916828ab238ab8bfa3244e2f',
    beforeNeoraid: '9236e128476c511cab26e158d92bf58680c758cc',
    beforeEngine: '827d2e396d19f53b3943bcf2e732995666f623c0',
    engine: 'dd03e0a37048132968216ed910ece8fa1177dcc6',
    reviewedDev: '38f548e2f537c0ef042aec42d7ea9c50a7959327'
});
const sourcePrefix = 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/';
const totalKeys = ['totalJs', 'totalCss', 'totalJsGzip', 'totalCssGzip'];
export const requireHosted = env => {
    assert.equal(env.GITHUB_ACTIONS, 'true', 'Static asset investigation runs only in hosted GitHub Actions.');
    assert.equal(env.GITHUB_REPOSITORY, 'alexphillips-dev/FolderView-Plus', 'Unexpected investigation repository.');
    assert.equal(env.GITHUB_EVENT_NAME, 'workflow_dispatch', 'Static investigation requires explicit hosted dispatch.');
};
export const isBudgetAsset = name => name.startsWith(sourcePrefix)
    && !name.slice(sourcePrefix.length).startsWith('scripts/include/') && /\.(js|css)$/i.test(name);

const readGitSnapshot = commit => {
    const git = args => execFileSync('git', args, { maxBuffer: 32 * 1024 * 1024 });
    assert.equal(git(['rev-parse', '--verify', `${commit}^{commit}`]).toString().trim(), commit);
    const entries = git(['ls-tree', '-r', '-z', commit, '--', sourcePrefix]).toString().split('\0').filter(Boolean);
    const assets = {}, totals = Object.fromEntries(totalKeys.map(key => [key, 0]));
    for (const entry of entries) {
        const split = entry.indexOf('\t'), name = entry.slice(split + 1);
        if (!isBudgetAsset(name)) continue;
        assert.match(entry.slice(0, split), /^100(?:644|755) blob [a-f0-9]{40}$/, `Unsupported asset tree entry: ${name}`);
        const contents = git(['show', `${commit}:${name}`]);
        const metric = { bytes: contents.length, gzipBytes: gzipSync(contents, { level: 9 }).length };
        const relative = name.slice(sourcePrefix.length);
        assets[relative] = metric;
        const kind = relative.endsWith('.js') ? 'Js' : relative.endsWith('.css') ? 'Css' : null;
        if (kind) {
            totals[`total${kind}`] += metric.bytes;
            totals[`total${kind}Gzip`] += metric.gzipBytes;
        }
    }
    assert.ok(Object.keys(assets).length, `No budgeted assets at ${commit}`);
    return { commit, assets, totals };
};

export const signedComparison = (before, after) => {
    const assets = {};
    for (const name of [...new Set([...Object.keys(before.assets), ...Object.keys(after.assets)])].sort()) {
        const oldMetric = before.assets[name], nextMetric = after.assets[name];
        const delta = { bytes: (nextMetric?.bytes || 0) - (oldMetric?.bytes || 0),
            gzipBytes: (nextMetric?.gzipBytes || 0) - (oldMetric?.gzipBytes || 0) };
        if (!delta.bytes && !delta.gzipBytes) continue;
        assets[name] = { before: oldMetric || null, after: nextMetric || null, delta,
            status: !oldMetric ? 'added' : !nextMetric ? 'removed' : 'changed' };
    }
    return { before: before.commit, after: after.commit,
        totals: Object.fromEntries(totalKeys.map(key => [key, after.totals[key] - before.totals[key]])), assets };
};

export const collectHostedAssetReport = ({ env = process.env, loadSnapshot = readGitSnapshot } = {}) => {
    // This gate precedes every Git read, asset read, compression and output write.
    requireHosted(env);
    const snapshots = Object.fromEntries(Object.entries(investigationRefs).map(([label, commit]) => [label, loadSnapshot(commit)]));
    const pairs = { stableToDev: ['publishedMain', 'reviewedDev'],
        dockerHydration: ['publishedMain', 'beforeNeoraid'], neoraid: ['beforeNeoraid', 'beforeEngine'],
        engineOwnership: ['beforeEngine', 'engine'], laterUiAndPrivacy: ['engine', 'reviewedDev'] };
    return { schemaVersion: 1, generatedAt: new Date().toISOString(),
        provenance: { repository: env.GITHUB_REPOSITORY, runId: env.GITHUB_RUN_ID || null,
            runAttempt: env.GITHUB_RUN_ATTEMPT || null, node: process.versions.node, zlib: process.versions.zlib },
        method: { source: 'immutable Git blobs; no source execution', gzipLevel: 9,
            excluded: ['scripts/include/'], baselineChanged: false, thresholdsChanged: false },
        refs: investigationRefs, snapshots,
        comparisons: Object.fromEntries(Object.entries(pairs).map(([label, [before, after]]) =>
            [label, signedComparison(snapshots[before], snapshots[after])])) };
};

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    requireHosted(process.env);
    const args = process.argv.slice(2);
    assert.ok(!args.length || (args.length === 2 && args[0] === '--output'), 'Usage: diagnose_static_assets.mjs [--output tmp/report.json]');
    const output = path.resolve(args[1] || 'tmp/fixture-browser-artifacts/static-asset-investigation.json');
    assert.ok(output.startsWith(path.resolve('tmp') + path.sep) && output.endsWith('.json'), 'Report must be a JSON artifact under tmp/.');
    const report = collectHostedAssetReport();
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
    console.log('Hosted static asset investigation completed; report includes fixed-SHA signed deltas. No budget or baseline was changed.');
    for (const [label, comparison] of Object.entries(report.comparisons)) console.log(label + ': ' + JSON.stringify(comparison.totals));
}
