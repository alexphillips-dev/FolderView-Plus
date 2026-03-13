import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const supportPolicyPath = path.join(repoRoot, 'SUPPORT_POLICY.md');
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
    assert.match(readme, /SUPPORT_POLICY\.md/);
});
