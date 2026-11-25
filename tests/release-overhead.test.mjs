import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
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

test('workflow-only publication keeps the package unchanged and rejects shipped changes', shellOnly, async t => {
    for (const changed of ['.github/workflows/fixture.yml', 'src/runtime.js', 'folderview.plus.plg', 'docs/sbom.cdx.json', 'scripts/package_page_format.mjs']) {
        await t.test(changed, t => {
            const f = fixture(t);
            f.git('config', 'core.filemode', 'true');
            f.copy('scripts/lib.sh'); f.copy('scripts/release_prepare.sh'); f.copy('scripts/package-build-inputs.txt');
            const source = fs.readFileSync(path.join(root, 'scripts/release_prepare.sh'), 'utf8');
            for (const name of new Set([...source.matchAll(/scripts\/[\w]+\.sh/g)].map(match => match[0]))) {
                if (!['scripts/release_prepare.sh', 'scripts/lib.sh'].includes(name)) f.write(name, `echo ${name}\n`, 0o644);
            }
            f.write('pkg_build.sh', 'echo unexpected-build > build.log\nexit 99\n', 0o644);
            f.write('folderview.plus.plg', '<!ENTITY version "2026.10.05.06">\n');
            f.write('archive/fixture.txz', 'unchanged package');
            f.write('scripts/release_validation.mjs', `import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
fs.writeFileSync('qualified.log', process.argv[2]);
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
execFileSync('git', ['push', 'origin', 'HEAD:refs/tags/fvplus-release-candidate-' + sha]);
`);
            const base = f.commit('Published package'); f.git('branch', '-M', 'main');
            const remote = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-workflow-origin-'));
            t.after(() => fs.rmSync(remote, { recursive: true, force: true }));
            execFileSync('git', ['clone', '--bare', f.directory, remote], { stdio: 'pipe' });
            f.git('remote', 'add', 'origin', remote);
            f.write(changed, 'changed fixture'); const candidate = f.commit('Workflow correction');
            const result = spawnSync('bash', ['scripts/release_prepare.sh', '--workflow-only', '--push-main'], {
                cwd: f.directory, encoding: 'utf8'
            });
            assert.equal(fs.existsSync(path.join(f.directory, 'build.log')), false);
            assert.equal(f.git('diff', '--summary'), '');
            assert.equal(f.git('diff', '--cached', '--summary'), '');
            assert.match(f.git('ls-tree', 'HEAD', 'scripts/doctor.sh'), /^100644 blob /);
            if (changed.startsWith('.github/')) {
                assert.equal(result.status, 0, result.stderr);
                assert.equal(f.git('rev-parse', 'origin/main'), candidate);
                assert.equal(fs.readFileSync(path.join(f.directory, 'qualified.log'), 'utf8'), 'qualify');
                assert.match(result.stdout, /Reusing the unchanged stable package/);
                assert.equal(f.git('show', 'origin/main:archive/fixture.txz'), 'unchanged package');
            } else {
                assert.notEqual(result.status, 0);
                assert.match(result.stderr, /Workflow-only publication cannot change/);
                assert.equal(f.git('rev-parse', 'origin/main'), base);
                assert.equal(fs.existsSync(path.join(f.directory, 'qualified.log')), false);
            }
        });
    }
});

test('dev finalization verifies the generated and staged SBOM before committing', shellOnly, async t => {
    for (const scenario of ['matching SBOM', 'matching SBOM with a package-transform change', 'stale SBOM', 'mismatched staged SBOM']) {
        await t.test(scenario, t => {
            const f = fixture(t);
            for (const file of ['scripts/lib.sh', 'scripts/dev_finalize.sh', 'scripts/generate_sbom.mjs', 'scripts/package-build-inputs.txt']) f.copy(file);
            f.write('.github/workflows/fixture.yml', 'name: Fixture\n');
            f.write('package-lock.json', '{}\n');
            const include = 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/include/.keep';
            f.write(include, '');
            f.write('scripts/runtime_components.json', JSON.stringify({ schemaVersion: 1, firstPartyFiles: [include] }));
            fs.mkdirSync(path.join(f.directory, 'docs'));
            f.write('folderview.plus.plg', '<!ENTITY version "2026.10.05.01">\n');
            f.write('folderview.plus.xml', '<Plugin/>\n');
            f.write('archive/fixture.txz', 'existing archive\n');
            f.write('pkg_build.sh', [
                "sed -i 's/2026.10.05.01/2026.10.05.02/' folderview.plus.plg",
                "printf 'new archive\\n' > archive/candidate.txz",
                scenario === 'stale SBOM' ? ':' : 'node scripts/generate_sbom.mjs'
            ].join('\n') + '\n');
            if (scenario === 'mismatched staged SBOM') {
                f.write('.gitattributes', 'docs/sbom.cdx.json filter=fixture\n');
                f.git('config', 'filter.fixture.clean', 'cat >/dev/null; printf "{}\n"');
            }
            execFileSync(process.execPath, ['scripts/generate_sbom.mjs'], { cwd: f.directory, stdio: 'pipe' });
            const base = f.commit('Published fixture');
            f.git('branch', '-M', 'dev');
            const changed = scenario.includes('transform') ? 'scripts/package_channel_messages.mjs' : 'src/folderview.plus/runtime.js';
            f.write(changed, 'fixture source update\n');
            f.git('add', changed);

            const result = spawnSync('bash', ['scripts/dev_finalize.sh', '--no-push', '--message', 'Finalize fixture'], {
                cwd: f.directory, encoding: 'utf8'
            });
            if (!scenario.startsWith('matching SBOM')) {
                assert.notEqual(result.status, 0);
                assert.match(result.stderr, scenario === 'stale SBOM'
                    ? /docs\/sbom\.cdx\.json is stale/
                    : /Staged docs\/sbom\.cdx\.json does not match/);
                assert.equal(f.git('rev-parse', 'HEAD'), base);
            } else {
                assert.equal(result.status, 0, result.stderr);
                assert.equal(JSON.parse(f.git('show', 'HEAD:docs/sbom.cdx.json')).metadata.component.version, '2026.10.05.02');
                assert.equal(f.git('show', 'HEAD:archive/candidate.txz'), 'new archive');
                assert.equal(f.git('status', '--porcelain'), '');
            }
        });
    }
});

test('documentation-only dev finalization retains the published package and version', shellOnly, t => {
    const f = fixture(t);
    f.copy('scripts/lib.sh');
    f.copy('scripts/dev_finalize.sh');
    f.copy('scripts/package-build-inputs.txt');
    f.write('folderview.plus.plg', '<!ENTITY version "2026.10.05.01">\n');
    f.write('archive/fixture.txz', 'existing package bytes\n');
    f.write('pkg_build.sh', 'echo unexpected-build >&2\nexit 55\n');
    const base = f.commit('Published package');
    f.git('branch', '-M', 'dev');
    f.write('README.md', 'Documentation update\n');
    f.git('add', 'README.md');
    const result = spawnSync('bash', ['scripts/dev_finalize.sh', '--no-push', '--message', 'Revise documentation'], {
        cwd: f.directory, encoding: 'utf8'
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /keeping the current package/);
    assert.equal(f.git('diff', '--name-only', base, 'HEAD'), 'README.md');
    assert.equal(f.git('show', 'HEAD:archive/fixture.txz'), 'existing package bytes');
});

test('release publication verifies both assets before making a draft public and resumes missing uploads', shellOnly, t => {
    const f = fixture(t);
    const tag = 'v2026.10.05.06';
    const packageName = 'folderview.plus-2026.10.05.06.txz';
    const checksumName = packageName + '.sha256';
    const checksum = createHash('sha256').update('archive bytes\n').digest('hex') + '  ' + packageName + '\n';
    for (const file of ['scripts/lib.sh', 'scripts/publish_github_release.sh']) f.copy(file);
    f.write(packageName, 'archive bytes\n');
    f.write(checksumName, checksum);
    f.write('release_notes.md', 'Preview notes\n');
    f.write('bin/git', '#!/bin/bash\ncase "$1" in\nls-remote) [ -f public-tag ] || exit 2 ;;\nfetch) : ;;\nrev-parse) cat public-tag ;;\n*) exit 88 ;;\nesac\n', 0o755);
    f.write('bin/gh', `#!/usr/bin/env node
const fs = require('node:fs');
const crypto = require('node:crypto');
const args = process.argv.slice(2);
const [area, action, tag, asset] = args;
if (area !== 'release' || tag !== 'v2026.10.05.06') process.exit(90);
const read = () => JSON.parse(fs.readFileSync('remote-release.json', 'utf8'));
const save = value => fs.writeFileSync('remote-release.json', JSON.stringify(value));
const record = value => fs.appendFileSync('mutations', value + '\\n');
if (action === 'create') {
    if (!args.includes('--draft') || fs.existsSync('remote-release.json')) process.exit(91);
    save({ isDraft: true, targetCommitish: args[args.indexOf('--target') + 1], assets: [] });
    record('create draft');
    process.exit(0);
}
if (!fs.existsSync('remote-release.json')) {
    console.error('release not found');
    process.exit(1);
}
const release = read();
if (action === 'view') {
    console.log(JSON.stringify(release));
} else if (action === 'upload') {
    if (args.includes('--clobber') || release.assets.some(entry => entry.name === asset)) process.exit(92);
    record('upload ' + asset);
    if (process.env.FVPLUS_FIXTURE_STOP_CHECKSUM === '1' && asset.endsWith('.sha256')) {
        release.assets.push({ name: asset, state: 'starter' });
        save(release);
        process.exit(93);
    }
    const content = fs.readFileSync(asset, 'utf8');
    const digest = asset.endsWith('.sha256') ? 'sha256:' + crypto.createHash('sha256').update(content).digest('hex') : null;
    release.assets.push({ name: asset, state: 'uploaded', content, digest });
    save(release);
} else if (action === 'download') {
    const name = args[args.indexOf('--pattern') + 1];
    fs.writeFileSync(args[args.indexOf('--output') + 1], release.assets.find(entry => entry.name === name).content);
} else if (action === 'delete-asset') {
    if (!release.isDraft || release.assets.find(entry => entry.name === asset)?.state !== 'starter') process.exit(94);
    release.assets = release.assets.filter(entry => entry.name !== asset);
    save(release);
    record('remove starter ' + asset);
} else if (action === 'edit' && args.includes('--draft=false')) {
    if (!release.isDraft || release.assets.filter(entry => entry.state === 'uploaded').length !== 2) process.exit(95);
    release.isDraft = false;
    save(release);
    fs.writeFileSync('public-tag', release.targetCommitish + '\\n');
    record('publish');
} else if (action === 'edit') {
    record('metadata');
} else {
    process.exit(96);
}
`, 0o755);
    const candidate = 'a'.repeat(40);
    const execute = (stopChecksum = false) => spawnSync('bash', ['scripts/publish_github_release.sh', tag, packageName, checksumName, 'release_notes.md'], {
        cwd: f.directory, encoding: 'utf8', timeout: 20000,
        env: { ...process.env, PATH: path.join(f.directory, 'bin') + path.delimiter + process.env.PATH,
            GITHUB_SHA: candidate, FVPLUS_GITHUB_RELEASE_ATTEMPTS: '2', FVPLUS_GITHUB_RELEASE_DELAY_SEC: '0',
            FVPLUS_FIXTURE_STOP_CHECKSUM: stopChecksum ? '1' : '0' }
    });
    const read = name => fs.readFileSync(path.join(f.directory, name), 'utf8');
    const remote = () => JSON.parse(read('remote-release.json'));
    const mutations = () => read('mutations').trim().split('\n');
    const failed = execute(true);
    assert.notEqual(failed.status, 0);
    assert.match(failed.stderr, /Upload release checksum failed/);
    assert.equal(remote().isDraft, true);
    assert.deepEqual(remote().assets.map(entry => entry.state), ['uploaded', 'starter']);
    assert.ok(!fs.existsSync(path.join(f.directory, 'public-tag')));
    const recovered = execute();
    assert.equal(recovered.status, 0, recovered.stderr);
    assert.equal(remote().isDraft, false);
    assert.equal(read('public-tag').trim(), candidate);
    assert.deepEqual(remote().assets.map(entry => entry.state), ['uploaded', 'uploaded']);
    assert.equal(mutations().filter(value => value === 'upload ' + packageName).length, 1);
    const completedMutations = mutations();
    const rerun = execute();
    assert.equal(rerun.status, 0, rerun.stderr);
    assert.deepEqual(mutations(), [...completedMutations, 'metadata']);
    const missingChecksum = remote();
    missingChecksum.assets = missingChecksum.assets.filter(entry => entry.name !== checksumName);
    f.write('remote-release.json', JSON.stringify(missingChecksum));
    const legacyRetry = execute();
    assert.equal(legacyRetry.status, 0, legacyRetry.stderr);
    const recoveredMutations = [...completedMutations, 'metadata', 'upload ' + checksumName, 'metadata'];
    assert.deepEqual(mutations(), recoveredMutations);
    const badRelease = remote();
    badRelease.assets[0].content = 'different archive';
    f.write('remote-release.json', JSON.stringify(badRelease));
    const conflict = execute();
    assert.notEqual(conflict.status, 0);
    assert.match(conflict.stderr, /Could not verify release asset/);
    assert.deepEqual(mutations(), recoveredMutations);
});

test('archive pruning rejects out-of-range retention before removing fixture files', shellOnly, t => {
    const f = fixture(t);
    for (const file of ['scripts/lib.sh', 'scripts/prune_archives.sh']) f.copy(file);
    for (const suffix of ['.txz', '.txz.sha256']) {
        for (const revision of ['01', '02', '03']) f.write('archive/folderview.plus-2026.01.01.' + revision + suffix, 'fixture');
    }
    const run = value => spawnSync('bash', ['scripts/prune_archives.sh', '--keep', value, '--current-version', '2026.01.01.03'],
        { cwd: f.directory, encoding: 'utf8' });
    for (const entry of ['9223372036854775808', '18446744073709551617', '1'.repeat(40)]) {
        const invalid = run(entry);
        assert.notEqual(invalid.status, 0);
        assert.match(invalid.stderr, /outside the supported integer range/);
        assert.equal(fs.readdirSync(path.join(f.directory, 'archive')).length, 6);
    }
    assert.match(run('000000099').stdout, /nothing to remove/);
    assert.match(run('000001').stdout, /removed 4 file/);
    assert.equal(fs.readdirSync(path.join(f.directory, 'archive')).length, 2);
});

test('icon pack output is independent of the caller umask and staged source modes', shellOnly, t => {
    const f = fixture(t);
    f.copy('scripts/build_icon_asset_pack.sh');
    const asset = 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/images/third-party-icons/sample/fixture.svg';
    f.write(asset, '<svg xmlns="http://www.w3.org/2000/svg"/>\n', 0o600);
    const build = (umask, outputDir) => spawnSync('bash', ['-c', 'umask "$1"; exec bash scripts/build_icon_asset_pack.sh', '--', umask], {
        cwd: f.directory, encoding: 'utf8',
        env: { ...process.env, FVPLUS_ICON_PACK_VERSION: '1.2.3', FVPLUS_ICON_PACK_OUTPUT_DIR: outputDir }
    });
    const normal = build('022', 'normal');
    assert.equal(normal.status, 0, normal.stderr);
    fs.chmodSync(path.join(f.directory, asset), 0o755);
    const privateBuild = build('077', 'private');
    assert.equal(privateBuild.status, 0, privateBuild.stderr);
    const archive = 'folderview.plus-icons-1.2.3.txz';
    for (const suffix of ['', '.sha256']) {
        assert.deepEqual(fs.readFileSync(path.join(f.directory, 'normal', archive + suffix)),
            fs.readFileSync(path.join(f.directory, 'private', archive + suffix)));
    }
    const modeReport = execFileSync('tar', ['-tvf', 'private/' + archive], { cwd: f.directory, encoding: 'utf8' });
    assert.match(modeReport, /^drwxr-xr-x.*third-party-icons\/sample\/$/m);
    assert.match(modeReport, /^-rw-r--r--.*fixture\.svg$/m);
});

test('pre-push rejects a dev candidate other than the clean checked-out commit', shellOnly, t => {
    const f = fixture(t);
    f.copy('.githooks/pre-push');
    f.write('scripts/main_branch_history_guard.sh', ':\n');
    f.write('folderview.plus.plg', '<!ENTITY version "2026.10.05.01">\n');
    const checkedOut = f.commit('Valid package');
    f.git('checkout', '-b', 'candidate');
    f.write('folderview.plus.plg', '<!ENTITY version "2026.10.05.02">\n');
    const candidate = f.commit('Candidate missing its package');
    f.git('checkout', '--detach', checkedOut);
    const runHook = ref => spawnSync('bash', ['.githooks/pre-push'], {
        cwd: f.directory, input: `refs/heads/candidate ${ref} refs/heads/dev ${checkedOut}\n`, encoding: 'utf8',
        env: { ...process.env, FVPLUS_SKIP_WORKSPACE_PERFORMANCE: '1', GITHUB_ACTIONS: '' }
    });
    const wrongTree = runHook(candidate);
    assert.notEqual(wrongTree.status, 0);
    assert.match(wrongTree.stderr, /clean checkout of the exact commit/);
    assert.doesNotMatch(wrongTree.stdout, /Running release guard checks/);
    f.git('checkout', '--detach', candidate);
    f.write('folderview.plus.plg', '<!ENTITY version "2026.10.05.01">\n');
    const changedTree = runHook(candidate);
    assert.notEqual(changedTree.status, 0);
    assert.match(changedTree.stderr, /clean checkout of the exact commit/);
    assert.doesNotMatch(changedTree.stdout, /Running release guard checks/);
});

test('package staging rejects eligible untracked source and redirected tracked paths', shellOnly, t => {
    const f = fixture(t);
    f.copy('scripts/lib.sh');
    f.write('.gitignore', 'tmp/\n');
    const trackedSource = 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/runtime.js';
    f.write(trackedSource, 'tracked source\n');
    f.commit('Package source');
    f.write('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/tmp/local-notes.md', 'ignored fixture\n');
    const newSource = 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/new-runtime.js';
    f.write(newSource, 'new runtime dependency\n');
    f.write('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/local-only.txt', 'excluded fixture\n');
    const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-package-input-'));
    t.after(() => fs.rmSync(staging, { recursive: true, force: true }));
    const copyInput = () => spawnSync('bash', ['-c', [
        'set -euo pipefail', 'source scripts/lib.sh', 'should_package() { [[ "$1" != */local-only.txt && "$1" != */scripts ]]; }',
        'fvplus::copy_indexed_package_source "$PWD" "$1" should_package'
    ].join('\n'), 'fixture', staging],
        { cwd: f.directory, encoding: 'utf8' });
    const untracked = copyInput();
    assert.notEqual(untracked.status, 0);
    assert.match(untracked.stderr, /outside the Git index: .*new-runtime\.js/);
    assert.deepEqual(fs.readdirSync(staging), []);
    f.git('add', '--', newSource);
    const result = copyInput();
    assert.equal(result.status, 0, result.stderr);
    const packagedPlugin = path.join(staging, 'usr/local/emhttp/plugins/folderview.plus');
    assert.deepEqual(fs.readdirSync(packagedPlugin), ['scripts']);
    assert.equal(fs.readFileSync(path.join(packagedPlugin, 'scripts/runtime.js'), 'utf8'), 'tracked source\n');
    assert.equal(fs.readFileSync(path.join(packagedPlugin, 'scripts/new-runtime.js'), 'utf8'), 'new runtime dependency\n');

    f.write('redirected/runtime.js', 'redirect target\n');
    const originalDirectory = path.dirname(path.join(f.directory, trackedSource));
    fs.renameSync(originalDirectory, path.join(f.directory, 'scripts-original'));
    fs.symlinkSync(path.join(f.directory, 'redirected'), originalDirectory);
    const redirected = copyInput();
    assert.notEqual(redirected.status, 0);
    assert.match(redirected.stderr, /indexed package source is missing or redirected/);
    assert.equal(fs.readFileSync(path.join(packagedPlugin, 'scripts/runtime.js'), 'utf8'), 'tracked source\n');
});

test('synchronization planner rejects stale main before executing repository scripts', shellOnly, t => {
    const f = fixture(t);
    const workflow = fs.readFileSync(path.join(root, '.github/workflows/backmerge-main-to-dev.yml'), 'utf8');
    const block = workflow.split('      - name: Verify published main and generate synchronization plan')[1]
        .split('      - name: Explain owner synchronization action')[0];
    const script = block.split('        run: |\n')[1].split('\n').map(line => line.replace(/^          /, '')).join('\n');
    f.write('scripts/release_validation.mjs', "import fs from 'node:fs'; fs.writeFileSync('executed.log', 'trusted scripts executed');\n");
    f.write('scripts/sync_main_to_dev.sh', 'exit 0\n'); f.write('scripts/sync_plan.mjs', '');
    const sha = f.commit('Trusted main'); f.git('branch', '-M', 'main');
    f.git('branch', 'dev', sha);
    const remote = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-planner-origin-'));
    t.after(() => fs.rmSync(remote, { recursive: true, force: true }));
    execFileSync('git', ['clone', '--bare', f.directory, remote], { stdio: 'pipe' });
    f.git('remote', 'add', 'origin', remote);
    const check = expected => spawnSync('bash', ['-c', 'set -euo pipefail\n' + script], {
        cwd: f.directory, encoding: 'utf8', env: { ...process.env, EXPECTED_MAIN: expected }
    });
    assert.notEqual(check('a'.repeat(40)).status, 0);
    assert.equal(fs.existsSync(path.join(f.directory, 'executed.log')), false);
    const trusted = check(sha);
    assert.equal(trusted.status, 0, trusted.stderr);
    assert.equal(fs.readFileSync(path.join(f.directory, 'executed.log'), 'utf8'), 'trusted scripts executed');
});

test('tag-only pre-push avoids repeated guards but mixed main pushes require candidate verification', shellOnly, t => {
    const f = fixture(t);
    f.copy('.githooks/pre-push');
    f.write('.gitignore', 'hook.log\n');
    for (const name of ['main_branch_history_guard', 'dev_version_bump_guard', 'release_guard', 'install_smoke',
        'include_order_guard', 'dead_code_guard', 'perf_budget_guard']) {
        f.write(`scripts/${name}.sh`, `echo ${name} >> hook.log\n`);
    }
    f.write('scripts/dev_version_bump_guard.sh',
        'printf "dev_version_bump_guard %s..%s\\n" "$FVPLUS_DEV_VERSION_BASE_REF" "$FVPLUS_DEV_VERSION_CANDIDATE_REF" >> hook.log\n');
    f.write('scripts/release_validation.mjs', "process.stderr.write('fixture rejects unqualified main'); process.exit(1);\n");
    const sha = f.commit('Hook fixture'); f.git('branch', '-M', 'main');
    const zeros = '0'.repeat(40), tag = `refs/tags/fvplus-release-candidate-${sha}`;
    const check = (input, environment = {}) => spawnSync('bash', ['.githooks/pre-push'], {
        cwd: f.directory, input, encoding: 'utf8',
        env: { ...process.env, FVPLUS_SKIP_WORKSPACE_PERFORMANCE: '0', GITHUB_ACTIONS: 'false', ...environment }
    });
    assert.equal(check(`${tag} ${sha} ${tag} ${zeros}\n`).status, 0);
    assert.equal(check(`(delete) ${zeros} ${tag} ${sha}\n`).status, 0);
    assert.equal(fs.existsSync(path.join(f.directory, 'hook.log')), false);
    assert.notEqual(check(`${tag} ${'a'.repeat(40)} ${tag} ${zeros}\n`).status, 0);
    for (const [environment, expectedGuards] of [
        [{}, 6],
        [{ FVPLUS_SKIP_WORKSPACE_PERFORMANCE: '1' }, 5],
        [{ FVPLUS_SKIP_WORKSPACE_PERFORMANCE: '1', GITHUB_ACTIONS: 'true' }, 6]
    ]) {
        f.write('hook.log', '');
        const main = check(`${tag} ${sha} ${tag} ${zeros}\nrefs/heads/main ${sha} refs/heads/main ${zeros}\n`, environment);
        assert.notEqual(main.status, 0);
        assert.match(main.stderr, /rejects unqualified main/);
        assert.equal(fs.readFileSync(path.join(f.directory, 'hook.log'), 'utf8').trim().split('\n').length, expectedGuards);
    }
    f.write('hook.log', '');
    const previousDev = 'b'.repeat(40);
    const mixed = check(`${tag} ${sha} ${tag} ${zeros}\nrefs/heads/topic ${sha} refs/heads/dev ${previousDev}\n`,
        { FVPLUS_SKIP_WORKSPACE_PERFORMANCE: '1' });
    assert.equal(mixed.status, 0, mixed.stderr);
    assert.ok(fs.readFileSync(path.join(f.directory, 'hook.log'), 'utf8')
        .includes('dev_version_bump_guard ' + previousDev + '..' + sha));
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
