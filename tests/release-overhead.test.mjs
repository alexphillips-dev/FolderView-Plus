import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { prepareDevPreview } from '../scripts/dev_release_preview.mjs';
import { makeOsvEvidence, osvDigest, osvIdentity } from '../scripts/lib/osv-evidence.mjs';

const root = process.cwd();
const shellOnly = { skip: process.platform === 'win32' };
function fixture(t) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-release-overhead-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const git = (...args) => execFileSync('git', args, { cwd: directory, encoding: 'utf8', stdio: 'pipe' }).trim();
    git('init'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.com');
    const write = (name, content, mode) => {
        fs.mkdirSync(path.dirname(path.join(directory, name)), { recursive: true });
        fs.writeFileSync(path.join(directory, name), content, { mode });
    };
    const copy = name => write(name, fs.readFileSync(path.join(root, name)));
    const commit = message => { git('add', '.'); git('commit', '--no-verify', '-m', message); return git('rev-parse', 'HEAD'); };
    return { directory, git, write, copy, commit };
}

test('detached release qualification enforces main merge history from the exact baseline', shellOnly, t => {
    const f = fixture(t);
    f.copy('scripts/lib.sh'); f.copy('scripts/main_branch_history_guard.sh');
    const base = f.commit('Base'); f.git('branch', '-M', 'main'); f.git('checkout', '-b', 'dev');
    f.write('dev.txt', 'dev'); f.commit('Dev work'); f.git('checkout', 'main');
    f.git('merge', '--no-ff', 'dev', '-m', 'Promote dev');
    const candidate = f.git('rev-parse', 'HEAD'); f.git('checkout', '--detach', candidate);
    const check = (sha = candidate, baseline = base) => spawnSync('bash', ['scripts/main_branch_history_guard.sh'], {
        cwd: f.directory, encoding: 'utf8', env: { ...process.env,
            GITHUB_REF_NAME: `fvplus-release-candidate-${sha}`, FVPLUS_MAIN_HISTORY_BASE_REF: baseline }
    });
    assert.equal(check().status, 0);
    assert.match(check().stdout, /passed: range=/);
    assert.notEqual(check('a'.repeat(40)).status, 0);
    assert.notEqual(check(candidate, '').status, 0);
    f.git('checkout', '-b', 'unrelated', base); f.write('bad.txt', 'unrelated'); f.commit('Unrelated work');
    f.git('checkout', 'main'); f.git('merge', '--no-ff', 'unrelated', '-m', 'Unapproved merge');
    const bad = f.git('rev-parse', 'HEAD'); f.git('checkout', '--detach', bad);
    assert.match(check(bad).stderr, /promote only dev history/);
});

test('tag-only pre-push avoids repeated guards but mixed main pushes require candidate verification', shellOnly, t => {
    const f = fixture(t);
    f.copy('.githooks/pre-push');
    for (const name of ['main_branch_history_guard', 'dev_version_bump_guard', 'release_guard', 'install_smoke',
        'include_order_guard', 'dead_code_guard', 'perf_budget_guard']) {
        f.write(`scripts/${name}.sh`, `echo ${name} >> hook.log\n`);
    }
    f.write('scripts/release_validation.mjs', "process.stderr.write('fixture rejects unqualified main'); process.exit(1);\n");
    const sha = f.commit('Hook fixture'); f.git('branch', '-M', 'main');
    const zeros = '0'.repeat(40), tag = `refs/tags/fvplus-release-candidate-${sha}`;
    const check = input => spawnSync('bash', ['.githooks/pre-push'], { cwd: f.directory, input, encoding: 'utf8' });
    assert.equal(check(`${tag} ${sha} ${tag} ${zeros}\n`).status, 0);
    assert.equal(check(`(delete) ${zeros} ${tag} ${sha}\n`).status, 0);
    assert.equal(fs.existsSync(path.join(f.directory, 'hook.log')), false);
    assert.notEqual(check(`${tag} ${'a'.repeat(40)} ${tag} ${zeros}\n`).status, 0);
    const main = check(`${tag} ${sha} ${tag} ${zeros}\nrefs/heads/main ${sha} refs/heads/main ${zeros}\n`);
    assert.notEqual(main.status, 0);
    assert.match(main.stderr, /rejects unqualified main/);
    assert.equal(fs.readFileSync(path.join(f.directory, 'hook.log'), 'utf8').trim().split('\n').length, 7);
});

test('release profile rejects missing or invalid baselines before qualification', shellOnly, t => {
    const directory = fixture(t).directory;
    const source = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
    const block = source.split('      - name: Select validation profile')[1].split('      - name: Classify changed paths')[0];
    const script = block.split('        run: |\n')[1].split('\n').map(line => line.replace(/^          /, '')).join('\n');
    for (const base of ['', 'HEAD', '0'.repeat(40)]) {
        const result = spawnSync('bash', ['-c', script], { encoding: 'utf8', env: { ...process.env,
            PROFILE: 'release', GITHUB_REF_NAME: 'candidate', GITHUB_EVENT_NAME: 'workflow_dispatch',
            BASE_SHA: base, GITHUB_OUTPUT: path.join(directory, 'output') } });
        assert.notEqual(result.status, 0);
        assert.equal(fs.existsSync(path.join(directory, 'output')), false);
    }
    const sha = 'a'.repeat(40);
    const result = spawnSync('bash', ['-c', script], { encoding: 'utf8', env: { ...process.env,
        PROFILE: 'release', GITHUB_REF_NAME: 'candidate', GITHUB_EVENT_NAME: 'workflow_dispatch',
        BASE_SHA: sha, GITHUB_OUTPUT: path.join(directory, 'output') } });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.readFileSync(path.join(directory, 'output'), 'utf8'), `release=true\nbase=${sha}\n`);
});

test('dev preview verifies committed bytes and uploads only the current package, checksum and notes', shellOnly, t => {
    const f = fixture(t), version = '2026.10.05.02', basename = `folderview.plus-${version}.txz`;
    f.copy('scripts/lib.sh'); f.copy('scripts/build_release_notes.sh');
    f.write('folderview.plus.plg', `<!ENTITY version "${version}">\n<!ENTITY pluginURL "https://example.com/dev/folderview.plus.plg">\n`);
    f.write('package-lock.json', '{}\n'); f.write(`docs/releases/${version}.md`, '- Fix: Fixture preview.\n');
    f.write(`archive/${basename}`, 'current package');
    f.write(`archive/${basename}.sha256`, `${osvDigest('current package')}  ${basename}\n`);
    f.write('archive/folderview.plus-2026.10.04.01.txz', 'old package'); f.commit('Preview fixture');
    const preview = prepareDevPreview(f.directory);
    assert.equal(preview.version, version);
    assert.deepEqual(fs.readdirSync(path.join(f.directory, 'tmp/dev-release-preview')).sort(), preview.files.sort());
    assert.match(fs.readFileSync(path.join(f.directory, 'tmp/dev-release-preview/release_notes.md'), 'utf8'), /Fixture preview/);
    f.write(`archive/${basename}`, 'altered package');
    assert.throws(() => prepareDevPreview(f.directory), /differs from committed/);
    f.write(`archive/${basename}`, 'current package');
    f.write(`archive/${basename}.sha256`, 'invalid');
    assert.throws(() => prepareDevPreview(f.directory), /committed checksum/);
});

test('OSV CLI writes and verifies reports only for committed inventory and its CI run', t => {
    const f = fixture(t);
    for (const name of ['scripts/osv_scan_evidence.mjs', 'scripts/lib/osv-evidence.mjs',
        'scripts/lib/github-release-validation.mjs', 'scripts/lib/release-evidence.mjs']) f.copy(name);
    f.write('docs/sbom.cdx.json', '{}\n'); f.write('package-lock.json', '{}\n'); const sha = f.commit('OSV fixture');
    assert.equal(osvIdentity(f.directory).commit, sha);
    f.write('results.sarif', JSON.stringify({ version: '2.1.0', runs: [{ results: [] }] }));
    const env = { ...process.env, GITHUB_ACTIONS: 'true', GITHUB_SHA: sha,
        GITHUB_REPOSITORY: 'example/fixture', GITHUB_RUN_ID: '42', GITHUB_RUN_ATTEMPT: '1' };
    const cli = (mode, overrides = {}) => spawnSync(process.execPath, ['scripts/osv_scan_evidence.mjs', mode], {
        cwd: f.directory, encoding: 'utf8', env: { ...env, ...overrides }
    });
    assert.equal(cli('write').status, 0);
    assert.equal(cli('verify').status, 0);
    assert.notEqual(cli('verify', { GITHUB_RUN_ATTEMPT: '2' }).status, 0);
    assert.notEqual(cli('write', { GITHUB_ACTIONS: 'false' }).status, 0);
    assert.notEqual(cli('write', { GITHUB_SHA: 'a'.repeat(40) }).status, 0);
    f.write('docs/sbom.cdx.json', 'changed inventory');
    assert.notEqual(cli('verify').status, 0);
});

test('main OSV reuse publishes the verified report and falls back to scanning if evidence is invalid', shellOnly, t => {
    const f = fixture(t);
    for (const name of ['scripts/osv_scan_evidence.mjs', 'scripts/lib/osv-evidence.mjs',
        'scripts/lib/github-release-validation.mjs', 'scripts/lib/release-evidence.mjs']) f.copy(name);
    f.write('docs/sbom.cdx.json', '{}\n'); f.write('package-lock.json', '{}\n'); const sha = f.commit('OSV reuse fixture');
    const sarif = Buffer.from(JSON.stringify({ version: '2.1.0', runs: [{ results: [] }] }));
    const proof = makeOsvEvidence(osvIdentity(f.directory), sarif, {
        repository: 'example/fixture', runId: 41, now: Date.now() - 23 * 3600000
    });
    const metadata = { id: 41, run_attempt: 1, head_sha: sha, repository: { full_name: 'example/fixture' },
        head_repository: { full_name: 'example/fixture' }, path: '.github/workflows/dependency-vulnerability-scan.yml',
        event: 'workflow_dispatch', head_branch: `fvplus-release-candidate-${sha}`, status: 'completed', conclusion: 'success' };
    f.write('source/results.sarif', sarif); f.write('source/osv-validation.json', JSON.stringify(proof));
    f.write('bin/gh.mjs', `import fs from 'node:fs'; import path from 'node:path';
const args=process.argv.slice(2);
if(args[0]==='api') console.log(JSON.stringify(args[1].includes('/artifacts')?
    {artifacts:[{name:'osv-validation-${sha}',expired:false}]}:{workflow_runs:[${JSON.stringify(metadata)}]}));
else if(args[0]==='run'&&args[1]==='download') {
    for(const name of ['results.sarif','osv-validation.json']) fs.copyFileSync('source/'+name,path.join(args.at(-1),name));
} else throw Error('Unexpected fixture command');
`);
    f.write('bin/gh', `#!/usr/bin/env bash\nexec '${process.execPath}' '${path.join(f.directory, 'bin/gh.mjs')}' "$@"\n`, 0o755);
    const env = { ...process.env, PATH: path.join(f.directory, 'bin') + path.delimiter + process.env.PATH,
        GITHUB_ACTIONS: 'true', GITHUB_SHA: sha, GITHUB_REPOSITORY: 'example/fixture',
        GITHUB_RUN_ID: '42', GITHUB_RUN_ATTEMPT: '1', GITHUB_OUTPUT: path.join(f.directory, 'output') };
    const cli = mode => spawnSync(process.execPath, ['scripts/osv_scan_evidence.mjs', mode], { cwd: f.directory, env, encoding: 'utf8' });
    assert.equal(cli('find').status, 0);
    assert.equal(fs.readFileSync(env.GITHUB_OUTPUT, 'utf8'), 'reused=true\n');
    const reissued = JSON.parse(fs.readFileSync(path.join(f.directory, 'tmp/osv-report/osv-validation.json')));
    assert.equal(reissued.validatedAt, proof.validatedAt);
    assert.equal(reissued.runId, 42);
    assert.equal(fs.readFileSync(path.join(f.directory, 'results.sarif')).compare(sarif), 0);
    assert.equal(cli('verify').status, 0);
    f.write('source/osv-validation.json', JSON.stringify({ ...proof, sbomSha256: 'd'.repeat(64) }));
    const invalid = cli('find');
    assert.equal(invalid.status, 0);
    assert.match(invalid.stdout, /fresh scan required/i);
    assert.match(fs.readFileSync(env.GITHUB_OUTPUT, 'utf8'), /reused=false\n$/);
});

test('synchronization retains its tag after failed publication and removes it only after verified alignment', shellOnly, t => {
    const f = fixture(t);
    f.write('scripts/remote_publish_guard.sh', 'exit "${FIXTURE_GUARD_STATUS:-0}"\n');
    const sha = f.commit('Sync fixture'); f.git('branch', '-M', 'dev');
    const remote = path.join(f.directory, 'remote.git');
    f.git('init', '--bare', remote); f.git('remote', 'add', 'origin', remote);
    const tag = `fvplus-sync-candidate-${sha}`;
    f.git('push', '--no-verify', 'origin', `HEAD:refs/tags/${tag}`);
    const source = fs.readFileSync('scripts/release_sync.sh', 'utf8');
    const suffix = 'git push --no-verify origin HEAD:dev' + source.split('git push --no-verify origin HEAD:dev')[1].split('\n)\n')[0];
    const check = status => spawnSync('bash', ['-c', 'set -euo pipefail\n' + suffix], {
        cwd: f.directory, encoding: 'utf8', env: { ...process.env, FIXTURE_GUARD_STATUS: String(status) }
    });
    assert.notEqual(check(1).status, 0);
    assert.match(f.git('ls-remote', '--tags', 'origin', `refs/tags/${tag}`), new RegExp(sha));
    const success = check(0);
    assert.equal(success.status, 0, success.stderr);
    assert.equal(f.git('ls-remote', '--tags', 'origin', `refs/tags/${tag}`), '');
});

test('workflow overhead reductions keep security publication, shared baselines and main push protections', () => {
    const read = name => fs.readFileSync(name, 'utf8');
    const osv = read('.github/workflows/dependency-vulnerability-scan.yml');
    assert.match(osv, /if: github.event_name == 'push' && github.ref_name == 'main'/);
    assert.match(osv, /upload-sarif@[a-f0-9]{40}/);
    assert.match(osv, /ref: \$\{\{ github.ref \}\}/);
    assert.match(osv, /sha: \$\{\{ github.sha \}\}/);
    assert.match(osv, /node scripts\/osv_scan_evidence.mjs verify/);
    const publisher = read('.github/workflows/release-on-main.yml');
    const scanTrigger = publisher.match(/grep -Eq '([^']+)' <<< "\$changed_paths"/)[1];
    const sensitivePaths = osv.split('  schedule:')[0].matchAll(/      - '([^']+)'/g);
    for (const [, file] of sensitivePaths) {
        assert.equal(new RegExp(scanTrigger).test(file), true, `Publisher must await main OSV for ${file}`);
    }
    const ci = read('.github/workflows/ci.yml');
    assert.match(ci, /BASE_REF: \$\{\{ needs.detect-changes.outputs.comparison_base \}\}/);
    assert.match(ci, /COMPARISON_BASE: \$\{\{ needs.detect-changes.outputs.comparison_base \}\}/);
    assert.match(ci, /node scripts\/dev_release_preview.mjs/);
    assert.doesNotMatch(ci, /pkg_build.sh --branch dev|path: archive\//);
    const sync = read('scripts/release_sync.sh');
    assert.ok(sync.indexOf('bash scripts/remote_publish_guard.sh') < sync.indexOf('tag="fvplus-sync-candidate-'));
    assert.ok(sync.indexOf('origin/dev...HEAD') < sync.indexOf('tag="fvplus-sync-candidate-'));
    for (const file of ['.github/actions/setup-ci-env/action.yml', '.github/workflows/ci.yml',
        '.github/workflows/codeql.yml', '.github/workflows/backmerge-main-to-dev.yml', '.github/workflows/dependency-vulnerability-scan.yml']) {
        assert.doesNotMatch(read(file), /(?:node-version:|default:) ['"]?20['"]?/);
        assert.match(read(file), /(?:node-version:|default:) ['"]24['"]/);
    }
});
