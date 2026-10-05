import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { githubApi, githubCommand } from './github-release-validation.mjs';
import { trustedValidationRun } from './release-evidence.mjs';

export const osvDigest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
export function osvIdentity(root = process.cwd()) {
    const git = (...args) => execFileSync('git', args, { cwd: root });
    const sbom = fs.readFileSync(path.join(root, 'docs/sbom.cdx.json'));
    assert.equal(sbom.compare(git('show', 'HEAD:docs/sbom.cdx.json')), 0, 'OSV inventory differs from committed inventory');
    return { commit: git('rev-parse', 'HEAD').toString().trim(), sbomSha256: osvDigest(sbom),
        scannerInputsSha256: osvDigest(git('ls-tree', '-r', 'HEAD', '--', '.github/workflows/dependency-vulnerability-scan.yml',
            'scripts/osv_scan_evidence.mjs', 'scripts/lib/osv-evidence.mjs', 'scripts/lib/github-release-validation.mjs',
            'scripts/lib/release-evidence.mjs', 'package-lock.json')) };
}
export function makeOsvEvidence(identity, sarif, { repository, runId, runAttempt = 1, now = Date.now(), validatedAt = new Date(now).toISOString() }) {
    const evidence = { schema: 1, ...identity, repository, runId, runAttempt, validatedAt, sarifSha256: osvDigest(sarif) };
    return verifyOsvEvidence(evidence, identity, sarif, { repository, runId, runAttempt, now });
}
export function verifyOsvEvidence(evidence, identity, sarif, { repository, runId, runAttempt = 1, now = Date.now() }) {
    assert.equal(evidence.schema, 1);
    assert.match(repository, /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/);
    assert.ok(Number.isSafeInteger(runId) && runId > 0 && Number.isSafeInteger(runAttempt) && runAttempt > 0);
    for (const [key, value] of Object.entries({ ...identity, repository, runId, runAttempt }))
        assert.equal(evidence[key], value, `OSV evidence differs: ${key}`);
    const age = now - Date.parse(evidence.validatedAt);
    assert.ok(Number.isFinite(age) && age >= -60000 && age <= 86400000, 'OSV evidence expired or has an invalid timestamp');
    assert.equal(evidence.sarifSha256, osvDigest(sarif), 'OSV SARIF digest mismatch');
    const report = JSON.parse(sarif.toString());
    assert.equal(report.version, '2.1.0', 'Invalid SARIF version');
    assert.ok(Array.isArray(report.runs) && report.runs.length > 0, 'Missing SARIF runs');
    for (const run of report.runs) {
        assert.ok(Array.isArray(run.results) && run.results.length === 0, 'OSV report contains vulnerabilities or missing results');
        assert.ok((run.invocations || []).every(invocation => invocation.executionSuccessful !== false), 'OSV report records scan failure');
    }
    return evidence;
}
export async function findOsvEvidence(identity, repository, { api = githubApi, command = githubCommand, now = Date.now() } = {}) {
    const ref = `fvplus-release-candidate-${identity.commit}`;
    const runs = api(`repos/${repository}/actions/workflows/dependency-vulnerability-scan.yml/runs?head_sha=${identity.commit}&per_page=30`).workflow_runs;
    const run = runs.filter(item => item.head_branch === ref && trustedValidationRun(item, repository, identity.commit, 'dependency-vulnerability-scan.yml'))
        .sort((a, b) => b.id - a.id)[0];
    if (!run || run.status !== 'completed' || run.conclusion !== 'success') return null;
    const artifact = api(`repos/${repository}/actions/runs/${run.id}/artifacts?per_page=100`).artifacts
        .find(item => item.name === `osv-validation-${identity.commit}` && !item.expired);
    if (!artifact) return null;
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-osv-'));
    try {
        command(['run', 'download', String(run.id), '--repo', repository, '--name', artifact.name, '--dir', directory]);
        const sarif = fs.readFileSync(path.join(directory, 'results.sarif'));
        const evidence = JSON.parse(fs.readFileSync(path.join(directory, 'osv-validation.json'), 'utf8'));
        verifyOsvEvidence(evidence, identity, sarif, { repository, runId: run.id, runAttempt: run.run_attempt || 1, now });
        return { evidence, sarif };
    } finally {
        assert.equal(path.dirname(directory), os.tmpdir());
        assert.ok(path.basename(directory).startsWith('fvplus-osv-'));
        fs.rmSync(directory, { recursive: true, force: true });
    }
}
