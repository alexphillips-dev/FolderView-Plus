import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { synchronizationPlan } from '../scripts/sync_plan.mjs';

const repoRoot = path.resolve(process.cwd());
const syncMainToDevPath = path.join(repoRoot, 'scripts/sync_main_to_dev.sh');

function gitTestEnv(extraEnv = {}) {
    const env = { ...process.env, ...extraEnv };
    delete env.GIT_ALTERNATE_OBJECT_DIRECTORIES;
    delete env.GIT_COMMON_DIR;
    delete env.GIT_DIR;
    delete env.GIT_INDEX_FILE;
    delete env.GIT_NAMESPACE;
    delete env.GIT_OBJECT_DIRECTORY;
    delete env.GIT_PREFIX;
    delete env.GIT_WORK_TREE;
    return env;
}

function runGit(args, cwd) {
    return execFileSync('git', args, {
        cwd,
        env: gitTestEnv(),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
    }).trim();
}

function writeFile(targetPath, contents) {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, contents);
}

function configureFixtureRepository(cwd) {
    runGit(['config', 'user.name', 'FolderView Plus Test'], cwd);
    runGit(['config', 'user.email', 'folderviewplus@example.com'], cwd);
    runGit(['config', 'core.autocrlf', 'false'], cwd);
    runGit(['remote', 'set-url', 'origin', '../remote.git'], cwd);
}

function runSyncMainToDev(cwd, branchName = 'backmerge/test') {
    execFileSync('bash', ['scripts/sync_main_to_dev.sh'], {
        cwd,
        encoding: 'utf8',
        env: gitTestEnv({
            FVPLUS_BACKMERGE_LOCAL_BRANCH: branchName
        }),
        stdio: ['ignore', 'pipe', 'pipe']
    });
}

test('sync_main_to_dev preserves main ancestry while keeping dev release artifacts when main release commits rename and add release-only paths', (t) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-sync-main-to-dev-'));
    t.after(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    const remoteDir = path.join(tempDir, 'remote.git');
    const workDir = path.join(tempDir, 'work');

    runGit(['init', '--bare', remoteDir], tempDir);
    runGit(['clone', remoteDir, workDir], tempDir);
    configureFixtureRepository(workDir);

    writeFile(path.join(workDir, 'scripts', 'sync_main_to_dev.sh'), fs.readFileSync(syncMainToDevPath, 'utf8'));
    writeFile(path.join(workDir, 'app.txt'), 'base\n');
    writeFile(path.join(workDir, 'folderview.plus.plg'), 'version=2026.04.05.12\n');
    writeFile(path.join(workDir, 'docs', 'releases', '2026.04.05.12.md'), 'Release 12\n');
    writeFile(path.join(workDir, 'archive', 'folderview.plus-2026.04.05.12.txz'), 'archive 12\n');
    writeFile(path.join(workDir, 'archive', 'folderview.plus-2026.04.05.12.txz.sha256'), 'sha256 12\n');

    runGit(['add', '.'], workDir);
    runGit(['commit', '-m', 'Initial repository state'], workDir);
    runGit(['branch', '-M', 'main'], workDir);
    runGit(['push', '-u', 'origin', 'main'], workDir);

    runGit(['checkout', '-B', 'dev'], workDir);
    runGit(['mv', 'docs/releases/2026.04.05.12.md', 'docs/releases/2026.04.05.14.md'], workDir);
    runGit(['mv', 'archive/folderview.plus-2026.04.05.12.txz', 'archive/folderview.plus-2026.04.05.14.txz'], workDir);
    fs.rmSync(path.join(workDir, 'archive', 'folderview.plus-2026.04.05.12.txz.sha256'));
    writeFile(path.join(workDir, 'archive', 'folderview.plus-2026.04.05.14.txz.sha256'), 'sha256 14\n');
    writeFile(path.join(workDir, 'folderview.plus.plg'), 'version=2026.04.05.14\n');
    runGit(['add', '-A'], workDir);
    runGit(['commit', '-m', 'Dev release artifacts'], workDir);
    runGit(['push', '-u', 'origin', 'dev'], workDir);

    runGit(['checkout', 'main'], workDir);
    writeFile(path.join(workDir, 'app.txt'), 'base\nmain change\n');
    runGit(['mv', 'docs/releases/2026.04.05.12.md', 'docs/releases/2026.04.05.13.md'], workDir);
    runGit(['mv', 'archive/folderview.plus-2026.04.05.12.txz', 'archive/folderview.plus-2026.04.05.13.txz'], workDir);
    fs.rmSync(path.join(workDir, 'archive', 'folderview.plus-2026.04.05.12.txz.sha256'));
    writeFile(path.join(workDir, 'archive', 'folderview.plus-2026.04.05.13.txz.sha256'), 'sha256 13\n');
    writeFile(path.join(workDir, 'folderview.plus.plg'), 'version=2026.04.05.13\n');
    runGit(['add', '-A'], workDir);
    runGit(['commit', '-m', 'Stable release 2026.04.05.13'], workDir);
    runGit(['push', 'origin', 'main'], workDir);

    runSyncMainToDev(workDir);

    const diffFiles = runGit(['diff', '--name-only', 'origin/dev..backmerge/test'], workDir)
        .split(/\r?\n/)
        .filter(Boolean);
    assert.deepEqual(diffFiles, ['app.txt']);
    assert.equal(synchronizationPlan(workDir).validationRequired, true);
    assert.equal(synchronizationPlan(workDir).changedFileCount, 1);
    assert.doesNotThrow(() => runGit(['merge-base', '--is-ancestor', 'origin/main', 'backmerge/test'], workDir));
    assert.equal(runGit(['rev-list', '--parents', '-n', '1', 'backmerge/test'], workDir).split(' ').length, 3);
    assert.equal(runGit(['show', 'backmerge/test:app.txt'], workDir), 'base\nmain change');
    assert.equal(runGit(['show', 'backmerge/test:folderview.plus.plg'], workDir), 'version=2026.04.05.14');
    assert.match(runGit(['ls-tree', '-r', '--name-only', 'backmerge/test'], workDir), /docs\/releases\/2026\.04\.05\.14\.md/);
    assert.doesNotMatch(runGit(['ls-tree', '-r', '--name-only', 'backmerge/test'], workDir), /2026\.04\.05\.13/);
    runGit(['checkout', 'dev'], workDir);
    writeFile(path.join(workDir, 'owner-work.txt'), 'unpublished commit');
    runGit(['add', '.'], workDir);
    runGit(['commit', '--no-verify', '-m', 'Unpublished owner work'], workDir);
    const unpublished = runGit(['rev-parse', 'HEAD'], workDir);
    assert.throws(() => runSyncMainToDev(workDir, 'dev'), /Command failed/);
    assert.equal(runGit(['rev-parse', 'HEAD'], workDir), unpublished);
    assert.equal(fs.readFileSync(path.join(workDir, 'owner-work.txt'), 'utf8'), 'unpublished commit');
    runGit(['checkout', '--detach', 'origin/dev'], workDir);
    runSyncMainToDev(workDir, 'HEAD');
    assert.equal(runGit(['branch', '--show-current'], workDir), '');
    assert.equal(synchronizationPlan(workDir).validationRequired, true);
});

test('sync_main_to_dev records main ancestry even when main differs only by release artifacts', (t) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-sync-main-to-dev-release-only-'));
    t.after(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    const remoteDir = path.join(tempDir, 'remote.git');
    const workDir = path.join(tempDir, 'work');

    runGit(['init', '--bare', remoteDir], tempDir);
    runGit(['clone', remoteDir, workDir], tempDir);
    configureFixtureRepository(workDir);

    writeFile(path.join(workDir, 'scripts', 'sync_main_to_dev.sh'), fs.readFileSync(syncMainToDevPath, 'utf8'));
    writeFile(path.join(workDir, 'folderview.plus.plg'), 'version=2026.04.05.12\n');
    writeFile(path.join(workDir, 'docs', 'releases', '2026.04.05.12.md'), 'Release 12\n');
    writeFile(path.join(workDir, 'archive', 'folderview.plus-2026.04.05.12.txz'), 'archive 12\n');
    writeFile(path.join(workDir, 'archive', 'folderview.plus-2026.04.05.12.txz.sha256'), 'sha256 12\n');

    runGit(['add', '.'], workDir);
    runGit(['commit', '-m', 'Initial repository state'], workDir);
    runGit(['branch', '-M', 'main'], workDir);
    runGit(['push', '-u', 'origin', 'main'], workDir);

    runGit(['checkout', '-B', 'dev'], workDir);
    runGit(['mv', 'docs/releases/2026.04.05.12.md', 'docs/releases/2026.04.05.14.md'], workDir);
    runGit(['mv', 'archive/folderview.plus-2026.04.05.12.txz', 'archive/folderview.plus-2026.04.05.14.txz'], workDir);
    fs.rmSync(path.join(workDir, 'archive', 'folderview.plus-2026.04.05.12.txz.sha256'));
    writeFile(path.join(workDir, 'archive', 'folderview.plus-2026.04.05.14.txz.sha256'), 'sha256 14\n');
    writeFile(path.join(workDir, 'folderview.plus.plg'), 'version=2026.04.05.14\n');
    runGit(['add', '-A'], workDir);
    runGit(['commit', '-m', 'Dev release artifacts'], workDir);
    runGit(['push', '-u', 'origin', 'dev'], workDir);

    runGit(['checkout', 'main'], workDir);
    runGit(['mv', 'docs/releases/2026.04.05.12.md', 'docs/releases/2026.04.05.13.md'], workDir);
    runGit(['mv', 'archive/folderview.plus-2026.04.05.12.txz', 'archive/folderview.plus-2026.04.05.13.txz'], workDir);
    fs.rmSync(path.join(workDir, 'archive', 'folderview.plus-2026.04.05.12.txz.sha256'));
    writeFile(path.join(workDir, 'archive', 'folderview.plus-2026.04.05.13.txz.sha256'), 'sha256 13\n');
    writeFile(path.join(workDir, 'folderview.plus.plg'), 'version=2026.04.05.13\n');
    runGit(['add', '-A'], workDir);
    runGit(['commit', '-m', 'Stable release 2026.04.05.13'], workDir);
    runGit(['push', 'origin', 'main'], workDir);

    runSyncMainToDev(workDir);

    const diffFiles = runGit(['diff', '--name-only', 'origin/dev..backmerge/test'], workDir)
        .split(/\r?\n/)
        .filter(Boolean);
    assert.deepEqual(diffFiles, []);
    assert.equal(synchronizationPlan(workDir).validationRequired, false);
    assert.equal(synchronizationPlan(workDir).unchanged, true);
    writeFile(path.join(workDir, 'unpublished.txt'), 'owner work');
    assert.throws(() => runSyncMainToDev(workDir), /Command failed/);
    assert.equal(fs.readFileSync(path.join(workDir, 'unpublished.txt'), 'utf8'), 'owner work');
    fs.rmSync(path.join(workDir, 'unpublished.txt'));
    assert.notEqual(runGit(['rev-parse', 'backmerge/test'], workDir), runGit(['rev-parse', 'origin/dev'], workDir));
    assert.doesNotThrow(() => runGit(['merge-base', '--is-ancestor', 'origin/main', 'backmerge/test'], workDir));
    assert.equal(runGit(['rev-list', '--parents', '-n', '1', 'backmerge/test'], workDir).split(' ').length, 3);
    assert.equal(runGit(['show', 'backmerge/test:folderview.plus.plg'], workDir), 'version=2026.04.05.14');
    assert.match(runGit(['ls-tree', '-r', '--name-only', 'backmerge/test'], workDir), /docs\/releases\/2026\.04\.05\.14\.md/);
    assert.doesNotMatch(runGit(['ls-tree', '-r', '--name-only', 'backmerge/test'], workDir), /2026\.04\.05\.13/);
});

test('sync_main_to_dev refuses to drop installer hooks or compatibility requirements from main', (t) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-sync-hooks-'));
    t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));
    const remoteDir = path.join(tempDir, 'remote.git');
    const workDir = path.join(tempDir, 'work');
    const manifest = (branch, version, command, min = '7.0.0') => [
        `<!ENTITY version "${version}">`,
        `<PLUGIN min="${min}">`,
        '  <FILE Name="archive">',
        `    <URL>https://raw.githubusercontent.com/&github;/${branch}/archive/&name;-&version;.txz</URL>`,
        '  </FILE>',
        '  <FILE Run="/bin/bash">',
        `    <INLINE>${command}</INLINE>`,
        '  </FILE>',
        '</PLUGIN>',
        ''
    ].join('\n');
    runGit(['init', '--bare', remoteDir], tempDir);
    runGit(['clone', remoteDir, workDir], tempDir);
    configureFixtureRepository(workDir);
    writeFile(path.join(workDir, 'scripts', 'sync_main_to_dev.sh'), fs.readFileSync(syncMainToDevPath, 'utf8'));
    const manifestPath = path.join(workDir, 'folderview.plus.plg');
    writeFile(manifestPath, manifest('main', '2026.04.05.12', 'old install command'));
    runGit(['add', '.'], workDir);
    runGit(['commit', '-m', 'Shared installer'], workDir);
    runGit(['branch', '-M', 'main'], workDir);

    runGit(['checkout', '-b', 'dev'], workDir);
    writeFile(manifestPath, manifest('dev', '2026.04.05.14', 'old install command'));
    runGit(['commit', '-am', 'Dev package metadata'], workDir);
    runGit(['push', '-u', 'origin', 'dev'], workDir);
    const originalDev = runGit(['rev-parse', 'HEAD'], workDir);

    runGit(['checkout', 'main'], workDir);
    writeFile(manifestPath, manifest('main', '2026.04.05.13', 'corrected install command'));
    runGit(['commit', '-am', 'Correct the stable installer'], workDir);
    runGit(['push', '-u', 'origin', 'main'], workDir);
    runGit(['checkout', 'dev'], workDir);
    assert.throws(() => runSyncMainToDev(workDir, 'dev'), error => /manifest installation requirements or hooks/.test(error.stderr));
    assert.equal(runGit(['rev-parse', 'HEAD'], workDir), originalDev);
    assert.equal(runGit(['status', '--porcelain'], workDir), '');

    const correctedDev = manifest('dev', '2026.04.05.15', 'corrected install command');
    writeFile(manifestPath, correctedDev);
    runGit(['commit', '-am', 'Apply the installer correction to dev'], workDir);
    runGit(['push', 'origin', 'dev'], workDir);
    runSyncMainToDev(workDir, 'dev');
    assert.doesNotThrow(() => runGit(['merge-base', '--is-ancestor', 'origin/main', 'HEAD'], workDir));
    assert.equal(fs.readFileSync(manifestPath, 'utf8'), correctedDev);

    const devWithCorrectedHook = runGit(['rev-parse', 'HEAD'], workDir);
    runGit(['push', 'origin', 'dev'], workDir);
    runGit(['checkout', 'main'], workDir);
    writeFile(manifestPath, manifest('main', '2026.04.05.16', 'corrected install command', '7.1.0'));
    runGit(['commit', '-am', 'Update minimum Unraid version'], workDir);
    runGit(['push', 'origin', 'main'], workDir);
    runGit(['checkout', 'dev'], workDir);
    assert.throws(() => runSyncMainToDev(workDir, 'dev'), error => /manifest installation requirements or hooks/.test(error.stderr));
    assert.equal(runGit(['rev-parse', 'HEAD'], workDir), devWithCorrectedHook);
    assert.equal(fs.readFileSync(manifestPath, 'utf8'), correctedDev);
});
