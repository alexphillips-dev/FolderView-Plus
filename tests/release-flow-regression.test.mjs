import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const repoRoot = path.resolve(process.cwd());

function writeFile(targetPath, contents) {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, contents);
}

function cleanupTempDir(targetPath) {
    try {
        fs.chmodSync(targetPath, 0o755);
    } catch {}
    for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
        const entryPath = path.join(targetPath, entry.name);
        if (entry.isDirectory()) {
            cleanupTempDir(entryPath);
            continue;
        }
        try {
            fs.chmodSync(entryPath, 0o644);
        } catch {}
    }
    for (let attempt = 0; attempt < 40; attempt += 1) {
        try {
            fs.rmSync(targetPath, { recursive: true, force: true });
            return;
        } catch (error) {
            if (!['EPERM', 'EBUSY', 'ENOTEMPTY'].includes(error.code) || attempt === 39) {
                throw error;
            }
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
        }
    }
}

function copyFileIntoTemp(tempRoot, relativePath) {
    const sourcePath = path.join(repoRoot, relativePath);
    const targetPath = path.join(tempRoot, relativePath);
    writeFile(targetPath, fs.readFileSync(sourcePath, 'utf8'));
}

function createBrokenGitBin(tempRoot) {
    const binDir = path.join(tempRoot, 'fake-bin');
    const gitPath = path.join(binDir, 'git');
    fs.mkdirSync(binDir, { recursive: true });
    fs.writeFileSync(gitPath, '#!/usr/bin/env bash\nexit 128\n');
    fs.chmodSync(gitPath, 0o755);
    return binDir;
}

function runBash(args, cwd, extraEnv = {}) {
    return execFileSync('bash', args, {
        cwd,
        encoding: 'utf8',
        env: {
            ...process.env,
            ...extraEnv
        },
        stdio: ['ignore', 'pipe', 'pipe']
    });
}

test('ensure_plg_changes_entry tolerates unavailable git metadata when curated notes exist', (t) => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-ensure-changes-'));
    t.after(() => {
        cleanupTempDir(tempRoot);
    });

    copyFileIntoTemp(tempRoot, 'scripts/ensure_plg_changes_entry.sh');
    copyFileIntoTemp(tempRoot, 'scripts/lib.sh');
    copyFileIntoTemp(tempRoot, 'scripts/release_note_categories.sh');
    copyFileIntoTemp(tempRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/release-note-categories.json');

    writeFile(path.join(tempRoot, 'folderview.plus.plg'), `<?xml version="1.0" standalone="yes"?>
<!DOCTYPE PLUGIN [
<!ENTITY name "folderview.plus">
<!ENTITY author "alexphillips-dev">
<!ENTITY github "alexphillips-dev/FolderView-Plus">
<!ENTITY launch "Settings/FolderViewPlus">
<!ENTITY plugdir "/usr/local/emhttp/plugins/&name;">
<!ENTITY pluginURL "https://raw.githubusercontent.com/&github;/dev/folderview.plus.plg">
<!ENTITY version "2026.04.15.02">
<!ENTITY md5 "placeholder">
]>
<PLUGIN name="&name;" author="&author;" version="&version;" launch="&launch;" pluginURL="&pluginURL;" icon="folder-icon.png" support="https://forums.unraid.net/topic/197631-plugin-folderview-plus/" min="7.0.0">
    <CHANGES>

###2026.04.15.01
- Fix: Previous release.
    </CHANGES>
</PLUGIN>
`);
    writeFile(path.join(tempRoot, 'docs', 'releases', '2026.04.15.02.md'), `- Fix: Prevent release-note insertion from failing when git metadata is unavailable.
- Quality: Allow curated notes to seed the new release block even when git probes fail.
`);

    const brokenGitBin = createBrokenGitBin(tempRoot);
    runBash(['scripts/ensure_plg_changes_entry.sh', '--version', '2026.04.15.02'], tempRoot, {
        PATH: `${brokenGitBin}${path.delimiter}${process.env.PATH ?? ''}`
    });

    const updatedPlg = fs.readFileSync(path.join(tempRoot, 'folderview.plus.plg'), 'utf8');
    assert.match(updatedPlg, /###2026\.04\.15\.02/);
    assert.match(updatedPlg, /Prevent release-note insertion from failing when git metadata is unavailable/);
});

test('pkg_build dry-run falls back to manifest branch when git branch detection is unavailable', (t) => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-pkg-build-'));
    t.after(() => {
        cleanupTempDir(tempRoot);
    });

    copyFileIntoTemp(tempRoot, 'pkg_build.sh');
    copyFileIntoTemp(tempRoot, 'scripts/generate_runtime_integrity_manifest.mjs');
    writeFile(path.join(tempRoot, 'folderview.plus.plg'), `<?xml version="1.0" standalone="yes"?>
<!DOCTYPE PLUGIN [
<!ENTITY name "folderview.plus">
<!ENTITY author "alexphillips-dev">
<!ENTITY github "alexphillips-dev/FolderView-Plus">
<!ENTITY launch "Settings/FolderViewPlus">
<!ENTITY plugdir "/usr/local/emhttp/plugins/&name;">
<!ENTITY pluginURL "https://raw.githubusercontent.com/&github;/dev/folderview.plus.plg">
<!ENTITY version "2026.04.15.01">
<!ENTITY md5 "placeholder">
]>
<PLUGIN name="&name;" author="&author;" version="&version;" launch="&launch;" pluginURL="&pluginURL;" icon="folder-icon.png" support="https://forums.unraid.net/topic/197631-plugin-folderview-plus/" min="7.0.0">
    <FILE Name="/tmp/folderview.plus.txz">
        <URL>https://raw.githubusercontent.com/&github;/dev/archive/&name;-&version;.txz</URL>
    </FILE>
</PLUGIN>
`);
    writeFile(path.join(tempRoot, 'folderview.plus.xml'), `<FILE Name="folderview.plus.plg"><Date>2026-04-15</Date><PluginURL>https://raw.githubusercontent.com/alexphillips-dev/FolderView-Plus/dev/folderview.plus.plg</PluginURL><Icon>https://raw.githubusercontent.com/alexphillips-dev/FolderView-Plus/dev/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/images/folder-icon.png</Icon><Beta>False</Beta><Name>FolderView Plus</Name></FILE>`);
    writeFile(path.join(tempRoot, 'scripts', 'release_guard.sh'), '#!/usr/bin/env bash\nexit 0\n');
    writeFile(path.join(tempRoot, 'scripts', 'ensure_plg_changes_entry.sh'), '#!/usr/bin/env bash\nexit 0\n');
    writeFile(path.join(tempRoot, 'scripts', 'icon_asset_pack_guard.sh'), '#!/usr/bin/env bash\nexit 0\n');
    fs.chmodSync(path.join(tempRoot, 'scripts', 'release_guard.sh'), 0o755);
    fs.chmodSync(path.join(tempRoot, 'scripts', 'ensure_plg_changes_entry.sh'), 0o755);
    fs.chmodSync(path.join(tempRoot, 'scripts', 'icon_asset_pack_guard.sh'), 0o755);
    writeFile(path.join(tempRoot, 'src', 'folderview.plus', 'usr', 'local', 'emhttp', 'plugins', 'folderview.plus', 'README.md'), 'placeholder\n');

    const brokenGitBin = createBrokenGitBin(tempRoot);
    const output = runBash(['pkg_build.sh', '--dry-run'], tempRoot, {
        PATH: `${brokenGitBin}${path.delimiter}${process.env.PATH ?? ''}`
    });

    assert.match(output, /Branch: dev/);
});

test('pkg_build tolerates non-zero tar exit when the archive remains readable', () => {
    const pkgBuild = fs.readFileSync(path.join(repoRoot, 'pkg_build.sh'), 'utf8');
    assert.match(pkgBuild, /tar_status=0/);
    assert.match(pkgBuild, /if \[ "\$tar_status" -ne 0 \]; then/);
    assert.match(pkgBuild, /if \[ -f "\$filename" \] && tar -tf "\$filename" >\/dev\/null 2>&1; then/);
    assert.match(pkgBuild, /WARN: tar exited with status \$tar_status but produced a readable archive; continuing\./);
    assert.match(pkgBuild, /ERROR: tar failed to create a readable archive \(status: \$tar_status\)\./);
});

for (const scenario of [
    { name: 'successful archive', createStatus: 0, readable: true, expectedStatus: 0 },
    { name: 'readable archive after a tar warning', createStatus: 1, readable: true, expectedStatus: 0 },
    { name: 'unreadable partial archive', createStatus: 2, readable: false, expectedStatus: 2 },
    { name: 'missing archive', createStatus: 2, readable: false, missing: true, expectedStatus: 2 }
]) {
    test(`pkg_build handles ${scenario.name} before updating release metadata`, (t) => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-tar-status-'));
        t.after(() => cleanupTempDir(tempRoot));
        const pkgBuild = fs.readFileSync(path.join(repoRoot, 'pkg_build.sh'), 'utf8');
        const archiveStep = pkgBuild.match(/tar_status=0[\s\S]*?(?=\ncd "\$CWD")/)?.[0];
        assert.ok(archiveStep, 'exercise the actual archive creation and failure handling');
        writeFile(path.join(tempRoot, 'archive-step.sh'), `#!/usr/bin/env bash
set -euo pipefail
exec 2>&1
filename=fixture.txz
tar() {
    if [[ "$1" == --sort=name ]]; then
        ${scenario.missing ? ':' : 'printf partial > "$filename"'}
        return ${scenario.createStatus}
    fi
    [[ "$1" == -tf ]] || exit 99
    return ${scenario.readable ? 0 : 2}
}
${archiveStep}
printf reached-metadata > metadata-marker
`);
        let status = 0;
        let output = '';
        try {
            output = runBash(['archive-step.sh'], tempRoot);
        } catch (error) {
            status = error.status;
            output = `${error.stdout || ''}${error.stderr || ''}`;
        }
        assert.equal(status, scenario.expectedStatus);
        assert.equal(fs.existsSync(path.join(tempRoot, 'metadata-marker')), scenario.expectedStatus === 0);
        if (scenario.createStatus !== 0) {
            assert.match(output, scenario.readable ? /WARN: tar exited with status 1/ : /ERROR: tar failed.*status: 2/);
        }
    });
}

test('package compression is identical with single and multi-threaded XZ defaults', (t) => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-compression-'));
    t.after(() => cleanupTempDir(tempRoot));
    const pkgBuild = fs.readFileSync(path.join(repoRoot, 'pkg_build.sh'), 'utf8');
    const command = pkgBuild.match(/if (tar --sort=name[\s\S]*?); then/)?.[1];
    assert.ok(command, 'exercise the actual package archive command');
    writeFile(path.join(tempRoot, 'input', 'payload.txt'), 'FolderView Plus reproducibility fixture\n'.repeat(4096));
    const archives = [];
    for (const threads of ['1', '2']) {
        const archive = path.join(tempRoot, `threads-${threads}.txz`);
        writeFile(path.join(tempRoot, 'compress.sh'), `filename="../threads-${threads}.txz"\n${command}\n`);
        runBash(['../compress.sh'], path.join(tempRoot, 'input'), {
            XZ_DEFAULTS: `--threads=${threads}`,
            XZ_OPT: `--threads=${threads}`
        });
        archives.push(fs.readFileSync(archive));
    }
    assert.deepEqual(archives[0], archives[1], 'archive bytes must not depend on XZ threading defaults');
});

for (const stagedDeletion of [false, true]) {
    test(`dev finalize ${stagedDeletion ? 'accepts staged deletion-only work' : 'rejects unstaged deletions before packaging'}`, (t) => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-finalize-gates-'));
        t.after(() => cleanupTempDir(tempRoot));
        const fixtureRepo = path.join(tempRoot, 'repo');
        fs.mkdirSync(fixtureRepo);
        const git = (...args) => execFileSync('git', args, { cwd: fixtureRepo, encoding: 'utf8', stdio: 'pipe' });
        git('init', '-q');
        writeFile(path.join(fixtureRepo, 'keep.txt'), 'before\n');
        writeFile(path.join(fixtureRepo, 'removed.txt'), 'before\n');
        git('add', '.');
        git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--no-verify', '-qm', 'fixture');
        fs.unlinkSync(path.join(fixtureRepo, 'removed.txt'));
        if (stagedDeletion) {
            git('add', 'removed.txt');
        } else {
            writeFile(path.join(fixtureRepo, 'keep.txt'), 'after\n');
            git('add', 'keep.txt');
        }
        const devFinalize = fs.readFileSync(path.join(repoRoot, 'scripts/dev_finalize.sh'), 'utf8');
        const gates = devFinalize.match(/mapfile -t STAGED_FILES[\s\S]*?(?=\nbash pkg_build\.sh)/)?.[0];
        assert.ok(gates, 'exercise the actual worktree gates before the package build');
        writeFile(path.join(tempRoot, 'gates.sh'), `#!/usr/bin/env bash
set -euo pipefail
fvplus::fail() { echo "$*" >&2; exit 1; }
print_path_list() { printf '%s\\n' "$@" >&2; }
${gates}
printf reached-package > package-marker
`);
        let status = 0;
        let output = '';
        try {
            runBash(['../gates.sh'], fixtureRepo);
        } catch (error) {
            status = error.status;
            output = `${error.stdout || ''}${error.stderr || ''}`;
        }
        assert.equal(status, stagedDeletion ? 0 : 1);
        assert.equal(fs.existsSync(path.join(fixtureRepo, 'package-marker')), stagedDeletion);
        if (!stagedDeletion) assert.match(output, /clean unstaged worktree/);
    });
}
