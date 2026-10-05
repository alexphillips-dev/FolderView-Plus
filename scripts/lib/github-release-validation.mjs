import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { trustedValidationRun, verifyReleaseEvidence } from './release-evidence.mjs';

export const githubCommand = (args, options = {}) => {
    // Capture CLI output; never print authentication material or subprocess environments.
    for (const command of process.platform === 'win32' ? ['gh'] : ['gh', 'gh.exe']) {
        try { return execFileSync(command, args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, ...options }).trim(); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    throw new Error('GitHub CLI is required for release validation');
};
export const githubApi = endpoint => JSON.parse(githubCommand(['api', endpoint]));

export async function findReleaseEvidence(identity, repository, { api = githubApi, command = githubCommand, runId, comparisonBase,
    excludeRunId = Number(process.env.GITHUB_RUN_ID) || 0 } = {}) {
    const runs = runId ? [api(`repos/${repository}/actions/runs/${runId}`)]
        : api(`repos/${repository}/actions/workflows/ci.yml/runs?head_sha=${identity.commit}&per_page=30`).workflow_runs
            .filter(run => run.id !== excludeRunId && trustedValidationRun(run, repository, identity.commit)).sort((a, b) => b.id - a.id);
    for (const run of runs) {
        if (!trustedValidationRun(run, repository, identity.commit)) continue;
        // A newer failed or unfinished validation must not be hidden by old success.
        if (run.status !== 'completed' || run.conclusion !== 'success') return null;
        const artifact = api(`repos/${repository}/actions/runs/${run.id}/artifacts?per_page=100`).artifacts
            .find(item => item.name === `release-validation-${identity.commit}` && !item.expired);
        if (!artifact) continue;
        const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-validation-'));
        try {
            command(['run', 'download', String(run.id), '--repo', repository, '--name', artifact.name, '--dir', directory]);
            const evidence = JSON.parse(fs.readFileSync(path.join(directory, 'release-validation.json'), 'utf8'));
            try { return verifyReleaseEvidence(evidence, identity, { repository, runId: run.id, runAttempt: run.run_attempt || 1, comparisonBase }); }
            catch (error) { if (runId) throw error; console.log(`[release-validation] Ignoring unusable evidence from run ${run.id}: ${error.message}`); }
        } finally {
            assert.equal(path.dirname(directory), os.tmpdir());
            assert.ok(path.basename(directory).startsWith('fvplus-validation-'));
            fs.rmSync(directory, { recursive: true, force: true });
        }
    }
    return null;
}

export async function waitForWorkflow(repository, commit, workflow, ref, { api = githubApi,
    pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)), attempts = 90, afterRunId = 0 } = {}) {
    for (let attempt = 0; attempt < attempts; attempt++) {
        const run = api(`repos/${repository}/actions/workflows/${workflow}/runs?head_sha=${commit}&per_page=30`).workflow_runs
            .filter(item => trustedValidationRun(item, repository, commit, workflow) && item.head_branch === ref && item.id > afterRunId)
            .sort((a, b) => b.id - a.id)[0];
        if (run?.status === 'completed') {
            assert.equal(run.conclusion, 'success', `${workflow} run ${run.id} ended with ${run.conclusion}`);
            return run;
        }
        console.log(`[release-validation] ${workflow} for ${commit.slice(0, 12)}: ${run?.status || 'waiting for dispatch'}`);
        await pause(20000);
    }
    throw new Error(`${workflow} did not complete within the bounded release wait`);
}
