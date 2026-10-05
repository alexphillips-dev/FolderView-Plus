import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

export const RELEASE_PROFILE = 'release-v2';
export const RELEASE_JOBS = ['lint-and-syntax', 'node-tests', 'guard-suite', 'dependency-review', 'fixture-browser', 'layout-checks'];
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const git = (root, ...args) => execFileSync('git', args, { cwd: root, maxBuffer: 16 * 1024 * 1024 });

export function releaseIdentity(root = process.cwd()) {
    const commit = git(root, 'rev-parse', 'HEAD').toString().trim();
    assert.match(commit, /^[a-f0-9]{40}$/, 'Invalid release commit');
    const manifest = git(root, 'show', 'HEAD:folderview.plus.plg').toString();
    const version = manifest.match(/<!ENTITY version "([0-9.]+)"/)?.[1];
    const channel = manifest.match(/<!ENTITY pluginURL "[^"\n]+\/(main|dev)\/folderview.plus.plg"/)?.[1];
    assert.ok(version && channel, 'Release manifest identity is missing');
    const archive = `archive/folderview.plus-${version}.txz`;
    const bytes = fs.readFileSync(`${root}/${archive}`);
    assert.equal(bytes.compare(git(root, 'show', `HEAD:${archive}`)), 0, 'Worktree package differs from committed package');
    return { commit, tree: git(root, 'rev-parse', 'HEAD^{tree}').toString().trim(), version, channel,
        archiveSha256: digest(bytes), lockSha256: digest(git(root, 'show', 'HEAD:package-lock.json')),
        validationInputsSha256: digest(git(root, 'ls-tree', '-r', 'HEAD', '--', 'src', 'scripts', 'tests', '.github', 'package.json', 'package-lock.json')) };
}

export function requireReleaseJobs(results) {
    for (const name of RELEASE_JOBS) assert.equal(results[name]?.result, 'success', `Required release job ${name} did not succeed`);
}

export function makeReleaseEvidence(identity, results, { repository, runId, runAttempt = 1, comparisonBase = identity.commit, now = Date.now() }) {
    requireReleaseJobs(results);
    assert.match(repository, /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/);
    assert.ok(Number.isSafeInteger(runId) && runId > 0, 'Missing validation run ID');
    assert.ok(Number.isSafeInteger(runAttempt) && runAttempt > 0, 'Missing validation run attempt');
    assert.match(comparisonBase, /^[a-f0-9]{40}$/, 'Missing release comparison base');
    return { schema: 1, profile: RELEASE_PROFILE, ...identity, repository, runId, runAttempt, comparisonBase,
        createdAt: new Date(now).toISOString(), jobs: Object.fromEntries(RELEASE_JOBS.map(name => [name, 'success'])) };
}

export function verifyReleaseEvidence(evidence, identity, { repository, runId, runAttempt = 1, comparisonBase, now = Date.now() }) {
    assert.equal(evidence.schema, 1, 'Unsupported validation evidence');
    assert.equal(evidence.profile, RELEASE_PROFILE, 'Wrong validation profile');
    assert.equal(evidence.repository, repository, 'Validation belongs to another repository');
    assert.equal(evidence.runId, runId, 'Validation run identity mismatch');
    assert.equal(evidence.runAttempt, runAttempt, 'Validation attempt identity mismatch');
    assert.match(evidence.comparisonBase, /^[a-f0-9]{40}$/, 'Missing comparison base');
    if (comparisonBase) assert.equal(evidence.comparisonBase, comparisonBase, 'Validation comparison base mismatch');
    for (const [key, value] of Object.entries(identity)) assert.equal(evidence[key], value, `Stale validation: ${key} differs`);
    const age = now - Date.parse(evidence.createdAt);
    assert.ok(Number.isFinite(age) && age >= -60000 && age <= 24 * 60 * 60 * 1000, 'Validation evidence expired or has an invalid timestamp');
    for (const name of RELEASE_JOBS) assert.equal(evidence.jobs?.[name], 'success', `Missing successful ${name} evidence`);
    return evidence;
}

export function trustedValidationRun(run, repository, commit, workflow = 'ci.yml') {
    return run.head_sha === commit && run.repository?.full_name === repository && run.head_repository?.full_name === repository
        && run.path === `.github/workflows/${workflow}` && ['push', 'workflow_dispatch'].includes(run.event)
        && (['main', 'dev'].includes(run.head_branch) || run.head_branch === `fvplus-release-candidate-${commit}`
            || run.head_branch === `fvplus-sync-candidate-${commit}`);
}
