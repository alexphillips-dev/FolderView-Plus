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
    fs.rmSync(targetPath, { recursive: true, force: true });
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
    fs.chmodSync(path.join(tempRoot, 'scripts', 'release_guard.sh'), 0o755);
    fs.chmodSync(path.join(tempRoot, 'scripts', 'ensure_plg_changes_entry.sh'), 0o755);
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
