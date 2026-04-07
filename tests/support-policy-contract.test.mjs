import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const supportPolicyPath = path.join(repoRoot, 'docs', 'SUPPORT_POLICY.md');
const readmePath = path.join(repoRoot, 'README.md');

const supportPolicy = fs.readFileSync(supportPolicyPath, 'utf8');
const readme = fs.readFileSync(readmePath, 'utf8');

test('support policy documents legacy compatibility commitments', () => {
    assert.match(supportPolicy, /folder\.view2/);
    assert.match(supportPolicy, /folder\.view3/);
    assert.match(supportPolicy, /legacy import payloads/i);
    assert.match(supportPolicy, /legacy custom override roots/i);
});

test('support policy documents selector contracts and deprecation window', () => {
    assert.match(supportPolicy, /Stable Selector\/Tag Contracts/);
    assert.match(supportPolicy, /td\.ct-name\.folder-name/);
    assert.match(supportPolicy, /td\.vm-name\.folder-name/);
    assert.match(supportPolicy, /folder-showcase-outer/);
    assert.match(supportPolicy, /2 stable releases/i);
});

test('readme links to support policy from legacy migration section', () => {
    assert.match(readme, /Legacy CSS\/JS Migration \(FolderView2\/3\)/);
    assert.match(readme, /docs\/SUPPORT_POLICY\.md/);
});

test('readme documents v2 support bundle preview and sanitized redaction defaults', () => {
    assert.match(readme, /copyable issue report, and a v2 support bundle export preview/);
    assert.match(readme, /Sanitized support bundles redact names, paths, URLs, IPs, and user-agent values by default/);
    assert.match(readme, /Review the support bundle preview before export\./);
    assert.match(readme, /v2 `redactionManifest`/);
    assert.match(readme, /exact build\/package identity, loaded plugin script\/style URLs and version queries, recent plugin actions, a bounded FolderView Plus API error-log tail, and browser-side JS error snapshots/);
});
