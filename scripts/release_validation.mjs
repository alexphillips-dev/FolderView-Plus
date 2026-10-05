import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { makeReleaseEvidence, reissueReleaseEvidence, releaseIdentity, verifyReleaseEvidence, trustedValidationRun } from './lib/release-evidence.mjs';
import { findReleaseEvidence, githubApi, githubCommand, waitForWorkflow } from './lib/github-release-validation.mjs';

const [mode, output = 'tmp/release-validation.json'] = process.argv.slice(2);
const identity = releaseIdentity();
const repository = process.env.GITHUB_REPOSITORY || 'alexphillips-dev/FolderView-Plus';
assert.match(repository, /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/);
const write = evidence => {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(evidence, null, 2) + '\n');
};

if (mode === 'write') {
    assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Release evidence must originate in GitHub CI');
    assert.equal(process.env.GITHUB_SHA, identity.commit, 'CI did not check out the exact candidate');
    assert.match(process.env.FVPLUS_RELEASE_COMPARISON_BASE || '', /^[a-f0-9]{40}$/, 'CI must supply the comparison base');
    write(makeReleaseEvidence(identity, JSON.parse(process.env.FVPLUS_JOB_RESULTS || '{}'),
        { repository, runId: Number(process.env.GITHUB_RUN_ID), runAttempt: Number(process.env.GITHUB_RUN_ATTEMPT), comparisonBase: process.env.FVPLUS_RELEASE_COMPARISON_BASE }));
} else if (mode === 'reissue') {
    assert.equal(process.env.GITHUB_ACTIONS, 'true');
    assert.equal(process.env.GITHUB_SHA, identity.commit);
    const source = await findReleaseEvidence(identity, repository);
    assert.ok(source, 'Cannot reuse missing or stale candidate evidence');
    write(reissueReleaseEvidence(source, identity,
        { repository, runId: Number(process.env.GITHUB_RUN_ID), runAttempt: Number(process.env.GITHUB_RUN_ATTEMPT) }));
} else if (mode === 'find') {
    const evidence = await findReleaseEvidence(identity, repository);
    if (evidence) write(evidence);
    if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `reused=${Boolean(evidence)}\n`);
    console.log(`[release-validation] Exact candidate evidence ${evidence ? 'verified and reused' : 'not available; fresh validation required'}`);
} else if (mode === 'verify') {
    const evidence = JSON.parse(fs.readFileSync(output, 'utf8'));
    const verified = await findReleaseEvidence(identity, repository, { runId: evidence.runId });
    assert.ok(verified, 'No trusted completed validation for this exact candidate');
    const latest = await findReleaseEvidence(identity, repository);
    assert.ok(latest && latest.runId === verified.runId && latest.runAttempt === verified.runAttempt,
        'A newer failed or unfinished validation invalidated this evidence');
    const comparisonBase = execFileSync('git', ['rev-parse', identity.channel === 'main' ? 'origin/main' : 'origin/dev'], { encoding: 'utf8' }).trim();
    verifyReleaseEvidence(evidence, identity, { repository, runId: verified.runId, runAttempt: verified.runAttempt, comparisonBase });
    const ref = `${identity.channel === 'main' ? 'fvplus-release-candidate-' : 'fvplus-sync-candidate-'}${identity.commit}`;
    await waitForWorkflow(repository, identity.commit, 'codeql.yml', ref);
    await waitForWorkflow(repository, identity.commit, 'dependency-vulnerability-scan.yml', ref);
} else if (mode === 'wait') {
    await waitForWorkflow(repository, identity.commit, 'ci.yml', 'main');
    // A fresh requalification can renew expired evidence without rewriting main.
    const evidence = await findReleaseEvidence(identity, repository);
    assert.ok(evidence, 'Successful main CI is missing exact-package release evidence');
    await waitForWorkflow(repository, identity.commit, 'codeql.yml', 'main');
    const scans = githubApi(`repos/${repository}/actions/workflows/dependency-vulnerability-scan.yml/runs?head_sha=${identity.commit}&per_page=30`).workflow_runs;
    const hasMainScan = scans.some(run => run.head_branch === 'main'
        && trustedValidationRun(run, repository, identity.commit, 'dependency-vulnerability-scan.yml'));
    const scanRef = process.env.FVPLUS_REQUIRE_MAIN_OSV === '1' || hasMainScan ? 'main' : `fvplus-release-candidate-${identity.commit}`;
    await waitForWorkflow(repository, identity.commit, 'dependency-vulnerability-scan.yml', scanRef);
    write(evidence);
} else if (mode === 'qualify') {
    const base = execFileSync('git', ['rev-parse', identity.channel === 'main' ? 'origin/main' : 'origin/dev'], { encoding: 'utf8' }).trim();
    const prefix = identity.channel === 'main' ? 'fvplus-release-candidate-' : 'fvplus-sync-candidate-';
    const tag = prefix + identity.commit;
    assert.equal(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(), '', 'Candidate must be clean');
    const existing = execFileSync('git', ['ls-remote', '--tags', 'origin', `refs/tags/${tag}`], { encoding: 'utf8' }).trim();
    if (existing) assert.equal(existing.split(/\s+/)[0], identity.commit, 'Candidate tag points to another commit');
    else execFileSync('git', ['push', 'origin', `HEAD:refs/tags/${tag}`], { stdio: 'inherit' });
    // Dispatch independent security checks before awaiting functional CI.
    const securityRuns = ['codeql.yml', 'dependency-vulnerability-scan.yml'].map(workflow => {
        const scans = githubApi(`repos/${repository}/actions/workflows/${workflow}/runs?head_sha=${identity.commit}&per_page=30`).workflow_runs;
        const latest = scans.filter(run => run.head_branch === tag && trustedValidationRun(run, repository, identity.commit, workflow))
            .sort((a, b) => b.id - a.id)[0];
        let afterRunId = 0;
        const scanExpired = latest?.status === 'completed'
            && !(Date.parse(latest.updated_at) >= Date.now() - 86400000);
        if (!latest || (latest.status === 'completed' && latest.conclusion !== 'success') || scanExpired) {
            afterRunId = latest?.id || 0;
            githubCommand(['workflow', 'run', workflow, '--repo', repository, '--ref', tag]);
        }
        return { workflow, afterRunId };
    });
    const evidence = await findReleaseEvidence(identity, repository, { comparisonBase: base });
    if (!evidence) {
        const previous = githubApi(`repos/${repository}/actions/workflows/ci.yml/runs?head_sha=${identity.commit}&per_page=30`).workflow_runs;
        const prior = previous.filter(run => run.head_branch === tag && trustedValidationRun(run, repository, identity.commit)).sort((a, b) => b.id - a.id);
        const pending = prior[0] && prior[0].status !== 'completed' ? prior[0] : null;
        const afterRunId = pending ? pending.id - 1 : Math.max(0, ...prior.map(run => run.id));
        if (!pending) githubCommand(['workflow', 'run', 'ci.yml', '--repo', repository, '--ref', tag, '-f', 'profile=release', '-f', `base_sha=${base}`]);
        const run = await waitForWorkflow(repository, identity.commit, 'ci.yml', tag, { afterRunId });
        const qualified = await findReleaseEvidence(identity, repository, { runId: run.id, comparisonBase: base });
        assert.ok(qualified, 'Candidate CI did not produce valid evidence');
        write(qualified);
    } else write(evidence);
    for (const { workflow, afterRunId } of securityRuns)
        await waitForWorkflow(repository, identity.commit, workflow, tag, { afterRunId });
    console.log(`[release-validation] Qualified exact candidate ${identity.commit}; temporary tag ${tag}`);
} else throw new Error('Usage: release_validation.mjs write|reissue|find|verify|wait|qualify [evidence-output]');
