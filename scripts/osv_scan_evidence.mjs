import assert from 'node:assert/strict';
import fs from 'node:fs';
import { findOsvEvidence, makeOsvEvidence, osvIdentity, verifyOsvEvidence } from './lib/osv-evidence.mjs';

const mode = process.argv[2];
const identity = osvIdentity();
const repository = process.env.GITHUB_REPOSITORY;
assert.equal(process.env.GITHUB_ACTIONS, 'true', 'OSV evidence is written only in CI');
assert.equal(process.env.GITHUB_SHA, identity.commit, 'OSV checkout does not match CI');
const directory = 'tmp/osv-report';
const proof = `${directory}/osv-validation.json`;
const output = evidence => {
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(proof, JSON.stringify(evidence, null, 2) + '\n');
};
const options = { repository, runId: Number(process.env.GITHUB_RUN_ID), runAttempt: Number(process.env.GITHUB_RUN_ATTEMPT) };
if (mode === 'find') {
    let found;
    try { found = await findOsvEvidence(identity, repository); }
    catch { console.log('[osv-evidence] Candidate report unavailable or invalid; fresh scan required.'); }
    if (found) {
        const evidence = makeOsvEvidence(identity, found.sarif, { ...options, validatedAt: found.evidence.validatedAt });
        output({ ...evidence, reusedFromRunId: found.evidence.runId });
        fs.writeFileSync('results.sarif', found.sarif);
        fs.writeFileSync(`${directory}/results.sarif`, found.sarif);
    }
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `reused=${Boolean(found)}\n`);
    console.log(`[osv-evidence] ${found ? 'Verified exact candidate report reused for main' : 'Fresh vulnerability scan required'}`);
} else if (mode === 'write') {
    const sarif = fs.readFileSync('results.sarif');
    output(makeOsvEvidence(identity, sarif, options));
    fs.writeFileSync(`${directory}/results.sarif`, sarif);
} else if (mode === 'verify') {
    verifyOsvEvidence(JSON.parse(fs.readFileSync(proof, 'utf8')), identity, fs.readFileSync('results.sarif'), options);
} else throw new Error('Usage: osv_scan_evidence.mjs find|write|verify');
