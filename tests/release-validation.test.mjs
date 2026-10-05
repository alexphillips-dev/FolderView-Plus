import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { makeReleaseEvidence, reissueReleaseEvidence, releaseIdentity, RELEASE_JOBS, trustedValidationRun, verifyReleaseEvidence } from '../scripts/lib/release-evidence.mjs';
import { findReleaseEvidence, waitForWorkflow } from '../scripts/lib/github-release-validation.mjs';
import { durationReport } from '../scripts/ci_duration_report.mjs';

const repository = 'example/fixture';
const identity = { commit: 'a'.repeat(40), tree: 'b'.repeat(40), version: '2026.10.05.03', channel: 'main',
    archiveSha256: 'c'.repeat(64), lockSha256: 'd'.repeat(64), validationInputsSha256: 'e'.repeat(64) };
const now = Date.parse('2026-10-05T20:00:00Z');
const results = Object.fromEntries(RELEASE_JOBS.map(name => [name, { result: 'success' }]));
const evidence = () => makeReleaseEvidence(identity, results, { repository, runId: 42, now });
const run = overrides => ({ id: 42, head_sha: identity.commit, repository: { full_name: repository },
    head_repository: { full_name: repository }, path: '.github/workflows/ci.yml', event: 'workflow_dispatch',
    head_branch: `fvplus-release-candidate-${identity.commit}`, status: 'completed', conclusion: 'success', ...overrides });

test('reissuing receipts cannot renew the original qualification expiry', () => {
    const options = { repository, runId: 43, now: now + 23 * 3600000 };
    const reissued = reissueReleaseEvidence(evidence(), identity, options);
    assert.equal(reissued.validatedAt, evidence().validatedAt);
    assert.equal(reissued.createdAt, new Date(options.now).toISOString());
    assert.equal(reissued.runId, 43);
    const again = reissueReleaseEvidence(reissued, identity, { ...options, runId: 44, now: options.now + 60000 });
    assert.equal(again.validatedAt, evidence().validatedAt);
    assert.throws(() => verifyReleaseEvidence(again, identity, { repository, runId: 44, now: now + 25 * 3600000 }), /expired/);
    assert.throws(() => reissueReleaseEvidence(again, identity, { repository, runId: 45, now: now + 25 * 3600000 }), /expired/);
    for (const overrides of [{ profile: 'release-v2' }, { validatedAt: undefined },
        { validatedAt: new Date(now + 1).toISOString() }]) {
        assert.throws(() => verifyReleaseEvidence({ ...evidence(), ...overrides }, identity, { repository, runId: 42, now }));
    }
});

test('duration reporting uses completed job timestamps without treating pending jobs as zero', () => {
    const report = durationReport([{ name: 'Fixture (chromium)', conclusion: 'success',
        started_at: '2026-10-05T20:00:00Z', completed_at: '2026-10-05T20:01:30Z' },
        { name: 'Quality', status: 'in_progress', started_at: '2026-10-05T20:01:30Z' }], results);
    assert.match(report, /success \| 90.0/);
    assert.match(report, /in_progress \| Pending/);
});

test('validation evidence binds every candidate input and rejects stale or skipped checks', () => {
    assert.deepEqual(verifyReleaseEvidence(evidence(), identity, { repository, runId: 42, now }), evidence());
    for (const key of Object.keys(identity)) {
        assert.throws(() => verifyReleaseEvidence({ ...evidence(), [key]: 'different' }, identity, { repository, runId: 42, now }), /differs/);
    }
    for (const name of RELEASE_JOBS) {
        for (const status of ['skipped', 'failure', 'cancelled', undefined]) {
            assert.throws(() => makeReleaseEvidence(identity, { ...results, [name]: { result: status } }, { repository, runId: 42, now }), /did not succeed/);
        }
    }
    for (const createdAt of ['invalid', new Date(now - 86400001).toISOString(), new Date(now + 60001).toISOString()]) {
        assert.throws(() => verifyReleaseEvidence({ ...evidence(), createdAt }, identity, { repository, runId: 42, now }), /timestamp/);
    }
    assert.throws(() => verifyReleaseEvidence(evidence(), identity, { repository: 'foreign/repo', runId: 42, now }));
    assert.throws(() => verifyReleaseEvidence(evidence(), identity, { repository, runId: 99, now }));
    assert.throws(() => verifyReleaseEvidence(evidence(), identity, { repository, runId: 42, now, comparisonBase: 'f'.repeat(40) }), /comparison base mismatch/);
});

test('only exact same-repository branch or qualification-tag workflow runs are trusted', () => {
    assert.equal(trustedValidationRun(run(), repository, identity.commit), true);
    for (const overrides of [{ head_sha: 'f'.repeat(40) }, { head_repository: { full_name: 'fork/fixture' } },
        { repository: { full_name: 'fork/fixture' } }, { event: 'pull_request' }, { head_branch: 'unrelated' },
        { head_branch: `fvplus-release-candidate-${'f'.repeat(40)}` }, { path: '.github/workflows/other.yml' }]) {
        assert.equal(trustedValidationRun(run(overrides), repository, identity.commit), false);
    }
});

test('artifact lookup ignores failed, foreign and expired runs and verifies downloaded run identity', async () => {
    const fresh = makeReleaseEvidence(identity, results, { repository, runId: 42 });
    let downloads = 0;
    const api = endpoint => endpoint.includes('/artifacts') ? { artifacts: [{ name: `release-validation-${identity.commit}`, expired: false }] }
        : endpoint.includes('/runs/42') ? run() : { workflow_runs: [run({ id: 43, event: 'pull_request' }), run({ id: 41, conclusion: 'failure' }), run()] };
    const command = args => { downloads++; fs.writeFileSync(path.join(args.at(-1), 'release-validation.json'), JSON.stringify(fresh)); };
    assert.deepEqual(await findReleaseEvidence(identity, repository, { api, command }), fresh);
    assert.equal(downloads, 1);
    assert.equal(await findReleaseEvidence(identity, repository, { api: () => ({ workflow_runs: [run({ id: 43, conclusion: 'failure' }), run()] }), command }), null);
    await assert.rejects(findReleaseEvidence(identity, repository, { runId: 42,
        api: endpoint => endpoint.includes('/artifacts') ? api(endpoint) : run({ run_attempt: 2 }), command }), /attempt identity/);
    assert.equal(await findReleaseEvidence(identity, repository, { api: endpoint => endpoint.includes('/artifacts')
        ? { artifacts: [{ name: `release-validation-${identity.commit}`, expired: true }] } : { workflow_runs: [run()] }, command }), null);
    assert.equal(downloads, 2, 'Expired artifacts do not add downloads');
    await assert.rejects(findReleaseEvidence(identity, repository, { runId: 42, api,
        command: args => fs.writeFileSync(path.join(args.at(-1), 'release-validation.json'), JSON.stringify({ ...fresh, runId: 99 })) }), /identity mismatch/);
});

test('workflow waits reject failure and timeout and do not accept an earlier failed dispatch', async () => {
    for (const conclusion of ['failure', 'cancelled', 'skipped']) {
        await assert.rejects(waitForWorkflow(repository, identity.commit, 'ci.yml', run().head_branch,
            { api: () => ({ workflow_runs: [run({ conclusion })] }), pause: async () => {}, attempts: 1 }), /ended with/);
    }
    await assert.rejects(waitForWorkflow(repository, identity.commit, 'ci.yml', run().head_branch,
        { api: () => ({ workflow_runs: [run({ status: 'queued' })] }), pause: async () => {}, attempts: 1 }), /bounded/);
    const accepted = await waitForWorkflow(repository, identity.commit, 'ci.yml', run().head_branch, {
        api: () => ({ workflow_runs: [run({ id: 40, conclusion: 'failure' }), run()] }), afterRunId: 40,
        pause: async () => {}, attempts: 1 });
    assert.equal(accepted.id, 42);
});

test('candidate identity uses committed canonical inputs and rejects altered package bytes', t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-evidence-fixture-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const git = (...args) => execFileSync('git', args, { cwd: directory, encoding: 'utf8', stdio: 'pipe' });
    git('init'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.com');
    fs.mkdirSync(path.join(directory, 'archive'));
    fs.writeFileSync(path.join(directory, 'folderview.plus.plg'), '<!ENTITY version "2026.10.05.03">\n<!ENTITY pluginURL "https://example.com/main/folderview.plus.plg">\n');
    fs.writeFileSync(path.join(directory, 'package-lock.json'), '{}\n');
    const archive = path.join(directory, 'archive/folderview.plus-2026.10.05.03.txz');
    fs.writeFileSync(archive, 'committed package');
    git('add', '.'); git('commit', '--no-verify', '-m', 'Fixture candidate');
    const first = releaseIdentity(directory);
    assert.equal(first.version, identity.version);
    fs.writeFileSync(archive, 'different package');
    assert.throws(() => releaseIdentity(directory), /differs from committed/);
});

test('release-note guard rejects disagreement between curated notes and the published manifest', { skip: process.platform === 'win32' }, t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-notes-fixture-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    fs.mkdirSync(path.join(directory, 'scripts'), { recursive: true });
    fs.mkdirSync(path.join(directory, 'docs/releases'), { recursive: true });
    fs.mkdirSync(path.join(directory, '.github/workflows'), { recursive: true });
    for (const name of ['lib.sh', 'build_release_notes.sh', 'release_notes_consistency_guard.sh']) {
        fs.copyFileSync(path.join(process.cwd(), 'scripts', name), path.join(directory, 'scripts', name));
    }
    fs.writeFileSync(path.join(directory, '.github/workflows/release-on-main.yml'), 'bash scripts/build_release_notes.sh\ngh release create --notes-file release_notes.md\n');
    const notes = path.join(directory, 'docs/releases/2026.10.05.03.md');
    fs.writeFileSync(notes, '- Fix: Current behavior.\n');
    fs.writeFileSync(path.join(directory, 'folderview.plus.plg'), '<!ENTITY version "2026.10.05.03">\n<CHANGES><![CDATA[\n###2026.10.05.03\n- Fix: Current behavior.\n]]></CHANGES>\n');
    const git = (...args) => execFileSync('git', args, { cwd: directory, stdio: 'pipe' });
    git('init'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.com');
    git('add', '.'); git('commit', '--no-verify', '-m', 'Notes fixture');
    const check = () => execFileSync('bash', ['scripts/release_notes_consistency_guard.sh'], {
        cwd: directory, encoding: 'utf8', stdio: 'pipe', env: { ...process.env, FVPLUS_REQUIRE_EXPLICIT_RELEASE_NOTES: '0' }
    });
    assert.match(check(), /guard passed/);
    fs.writeFileSync(notes, '- Fix: Different behavior.\n');
    assert.throws(check, error => String(error.stderr).includes('CHANGES and curated release notes disagree'));
});

test('qualification dispatches independent checks on an exact tag and never promotes a failed candidate', { skip: process.platform === 'win32' }, t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-qualification-fixture-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const work = path.join(directory, 'work');
    const remote = path.join(directory, 'remote.git');
    const bin = path.join(directory, 'bin');
    const stateFile = path.join(directory, 'state.json');
    fs.mkdirSync(work); fs.mkdirSync(bin);
    const git = (...args) => execFileSync('git', args, { cwd: work, encoding: 'utf8', stdio: 'pipe' }).trim();
    git('init'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.com');
    for (const name of ['release_validation.mjs', 'lib/release-evidence.mjs', 'lib/github-release-validation.mjs']) {
        const target = path.join(work, 'scripts', name);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(path.join(process.cwd(), 'scripts', name), target);
    }
    fs.mkdirSync(path.join(work, 'archive'));
    fs.writeFileSync(path.join(work, '.gitignore'), 'tmp/\n');
    fs.writeFileSync(path.join(work, 'folderview.plus.plg'), '<!ENTITY version "2026.10.05.03">\n<!ENTITY pluginURL "https://example.com/main/folderview.plus.plg">\n');
    fs.writeFileSync(path.join(work, 'package-lock.json'), '{}\n');
    fs.writeFileSync(path.join(work, 'archive/folderview.plus-2026.10.05.03.txz'), 'synthetic package');
    git('add', '.'); git('commit', '--no-verify', '-m', 'Fixture base'); git('branch', '-M', 'main');
    git('init', '--bare', remote); git('remote', 'add', 'origin', remote);
    for (const branch of ['main', 'dev', 'metrics']) git('push', 'origin', `HEAD:refs/heads/${branch}`);
    git('fetch', 'origin');
    const base = git('rev-parse', 'HEAD');
    const mock = path.join(bin, 'gh.mjs');
    fs.writeFileSync(mock, `import fs from 'node:fs';
import { releaseIdentity, makeReleaseEvidence, RELEASE_JOBS } from ${JSON.stringify(new URL('file://' + path.join(work, 'scripts/lib/release-evidence.mjs')).href)};
const file=process.env.FVPLUS_MOCK_STATE, state=JSON.parse(fs.readFileSync(file)), args=process.argv.slice(2);
const tag='fvplus-release-candidate-'+state.commit, repository='example/fixture';
const metadata=(workflow)=>({id:workflow==='ci.yml'?100:workflow==='codeql.yml'?101:102,run_attempt:1,head_sha:state.commit,head_branch:tag,event:'workflow_dispatch',path:'.github/workflows/'+workflow,repository:{full_name:repository},head_repository:{full_name:repository},status:'completed',conclusion:workflow==='ci.yml'?state.result:'success'});
if(args[0]==='workflow') { const workflow=args[2]; state.dispatched.push(workflow); fs.writeFileSync(file,JSON.stringify(state)); }
else if(args[0]==='api') {
 const endpoint=args[1], workflow=endpoint.match(/workflows\\/([^/]+)\\/runs/)?.[1];
 const output=workflow?{workflow_runs:state.dispatched.includes(workflow)?[metadata(workflow)]:[]}:endpoint.includes('/artifacts')?{artifacts:[{name:'release-validation-'+state.commit,expired:false}]}:metadata('ci.yml');
 console.log(JSON.stringify(output));
} else if(args[0]==='run'&&args[1]==='download') {
 const proof=makeReleaseEvidence(releaseIdentity(),Object.fromEntries(RELEASE_JOBS.map(name=>[name,{result:'success'}])),{repository,runId:100,comparisonBase:state.base});
 fs.writeFileSync(args.at(-1)+'/release-validation.json',JSON.stringify(proof));
} else throw Error('Unexpected mock GitHub command');
`);
    fs.writeFileSync(path.join(bin, 'gh'), `#!/usr/bin/env bash\nexec '${process.execPath}' '${mock}' "$@"\n`, { mode: 0o755 });
    const qualify = result => {
        fs.writeFileSync(stateFile, JSON.stringify({ commit: git('rev-parse', 'HEAD'), base, result, dispatched: [] }));
        return execFileSync(process.execPath, ['scripts/release_validation.mjs', 'qualify'], { cwd: work,
            encoding: 'utf8', stdio: 'pipe', env: { ...process.env, PATH: bin + path.delimiter + process.env.PATH,
                GITHUB_REPOSITORY: 'example/fixture', FVPLUS_MOCK_STATE: stateFile } });
    };
    fs.writeFileSync(path.join(work, 'candidate.txt'), 'qualified candidate'); git('add', '.'); git('commit', '--no-verify', '-m', 'Fixture candidate');
    assert.match(qualify('success'), /Qualified exact candidate/);
    assert.deepEqual(JSON.parse(fs.readFileSync(stateFile)).dispatched, ['codeql.yml', 'dependency-vulnerability-scan.yml', 'ci.yml']);
    assert.equal(JSON.parse(fs.readFileSync(path.join(work, 'tmp/release-validation.json'))).commit, git('rev-parse', 'HEAD'));
    fs.writeFileSync(path.join(work, 'candidate.txt'), 'failing candidate'); git('add', '.'); git('commit', '--no-verify', '-m', 'Failing fixture candidate');
    assert.throws(() => qualify('failure'), error => String(error.stderr).includes('ended with failure'));
    assert.equal(git('--git-dir=' + remote, 'rev-parse', 'main'), base);
    const branches = git('ls-remote', '--heads', 'origin').split('\n').map(line => line.split('\t')[1]);
    assert.deepEqual(branches, ['refs/heads/dev', 'refs/heads/main', 'refs/heads/metrics']);
    assert.match(git('ls-remote', '--tags', 'origin'), new RegExp('fvplus-release-candidate-' + git('rev-parse', 'HEAD')));
});
