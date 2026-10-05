import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { findOsvEvidence, makeOsvEvidence, osvDigest, verifyOsvEvidence } from '../scripts/lib/osv-evidence.mjs';

const repository = 'example/fixture';
const identity = { commit: 'a'.repeat(40), sbomSha256: 'b'.repeat(64), scannerInputsSha256: 'c'.repeat(64) };
const now = Date.parse('2026-10-05T20:00:00Z');
// The pinned OSV reporter initializes an empty results array for clean scans.
const report = Buffer.from(JSON.stringify({ version: '2.1.0', runs: [{ tool: { driver: { name: 'osv-scanner' } }, results: [] }] }));
const options = { repository, runId: 42, runAttempt: 1, now };
const proof = () => makeOsvEvidence(identity, report, options);
const run = overrides => ({ id: 42, run_attempt: 1, head_sha: identity.commit, repository: { full_name: repository },
    head_repository: { full_name: repository }, path: '.github/workflows/dependency-vulnerability-scan.yml', event: 'workflow_dispatch',
    head_branch: `fvplus-release-candidate-${identity.commit}`, status: 'completed', conclusion: 'success', ...overrides });

test('OSV reuse binds the exact inventory, scanner inputs, report, repository and run', () => {
    assert.deepEqual(verifyOsvEvidence(proof(), identity, report, options), proof());
    for (const key of Object.keys(identity)) assert.throws(() => verifyOsvEvidence({ ...proof(), [key]: 'different' }, identity, report, options), /differs/);
    for (const changed of [{ repository: 'foreign/repo' }, { runId: 43 }, { runAttempt: 2 }]) {
        assert.throws(() => verifyOsvEvidence(proof(), identity, report, { ...options, ...changed }), /differs/);
    }
    assert.throws(() => verifyOsvEvidence(proof(), identity, Buffer.from('tampered'), options), /digest mismatch/);
    for (const invalid of [{ version: '2.0.0', runs: [] }, { version: '2.1.0', runs: [] },
        { version: '2.1.0', runs: [{ results: [{ ruleId: 'CVE-fixture' }] }] },
        { version: '2.1.0', runs: [{}] }, { version: '2.1.0', runs: [{ results: null }] },
        { version: '2.1.0', runs: [{ results: [], invocations: [{ executionSuccessful: false }] }] }]) {
        const bytes = Buffer.from(JSON.stringify(invalid));
        assert.throws(() => verifyOsvEvidence({ ...proof(), sarifSha256: osvDigest(bytes) }, identity, bytes, options));
    }
});

test('OSV receipts retain the first scan timestamp and reject expired or future scans', () => {
    const reissued = makeOsvEvidence(identity, report, { ...options, runId: 43, now: now + 23 * 3600000, validatedAt: proof().validatedAt });
    assert.equal(reissued.validatedAt, proof().validatedAt);
    assert.throws(() => verifyOsvEvidence(reissued, identity, report, { ...options, runId: 43, now: now + 25 * 3600000 }), /expired/);
    for (const validatedAt of ['invalid', undefined, new Date(now + 60001).toISOString()]) {
        assert.throws(() => verifyOsvEvidence({ ...proof(), validatedAt }, identity, report, options), /timestamp/);
    }
});

test('OSV lookup only downloads the latest successful exact release tag from this repository', async () => {
    let downloads = 0;
    const command = args => {
        downloads++;
        fs.writeFileSync(path.join(args.at(-1), 'results.sarif'), report);
        fs.writeFileSync(path.join(args.at(-1), 'osv-validation.json'), JSON.stringify(proof()));
    };
    const artifacts = { artifacts: [{ name: `osv-validation-${identity.commit}`, expired: false }] };
    const lookup = runs => findOsvEvidence(identity, repository, {
        now, command, api: endpoint => endpoint.includes('/artifacts') ? artifacts : { workflow_runs: runs }
    });
    const found = await lookup([run()]);
    assert.deepEqual(found.evidence, proof());
    assert.equal(found.sarif.compare(report), 0);
    for (const changed of [{ conclusion: 'failure' }, { conclusion: 'cancelled' }, { status: 'in_progress' },
        { head_branch: 'main' }, { head_branch: `fvplus-sync-candidate-${identity.commit}` },
        { head_sha: 'd'.repeat(40) }, { event: 'pull_request' }, { head_repository: { full_name: 'fork/fixture' } }]) {
        assert.equal(await lookup([run(changed)]), null);
    }
    assert.equal(await lookup([run({ id: 43, conclusion: 'failure' }), run()]), null, 'A newer failed scan blocks older success');
    assert.equal(downloads, 1);
    await assert.rejects(lookup([run({ run_attempt: 2 })]), /runAttempt/);
    for (const entries of [[], [{ name: artifacts.artifacts[0].name, expired: true }]]) {
        assert.equal(await findOsvEvidence(identity, repository, { now, command,
            api: endpoint => endpoint.includes('/artifacts') ? { artifacts: entries } : { workflow_runs: [run()] } }), null);
    }
    await assert.rejects(findOsvEvidence(identity, repository, { now: now + 25 * 3600000, command,
        api: endpoint => endpoint.includes('/artifacts') ? artifacts : { workflow_runs: [run()] } }), /expired/);
});
