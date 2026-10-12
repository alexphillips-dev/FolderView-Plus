import test from 'node:test';
import { runConfigWriteFixture } from './helpers/config-write-fixture.mjs';

test('environment import restores exact Docker and VM state after a nested metadata failure', () => {
    for (const type of ['docker', 'vm']) for (const kind of ['folder', 'prefs']) {
        const result = runConfigWriteFixture({ type, kind, operation: 'environment' });
        assert.ok(result.observed);
        assert.match(result.error, /All changed configuration was restored/);
        assert.deepEqual(result.after, result.before);
        assert.equal(result.otherUnchanged, true);
    }
});
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runCaptureFixture } from './helpers/transaction-capture.mjs';

const repoRoot = path.resolve(process.cwd());
const serverRoot = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server');
const libPath = path.join(serverRoot, 'lib.php');
const phpString = (value) => `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

test('environment capture rejects failed reads and non-files without empty compensation', () => {
    for (const operation of ['failed-read', 'short-read', 'stat-failure']) {
        const failed = runCaptureFixture(operation);
        assert.equal(failed.rejected, true, operation);
        assert.equal(failed.unchanged, true, operation);
    }
    assert.equal(runCaptureFixture('unsupported').rejected, true);
});

test('Linux capture and compensation respect actual permissions and symlink boundaries', {
    skip: process.platform === 'win32' || (typeof process.getuid === 'function' && process.getuid() === 0)
        ? 'Real permissions require an unprivileged POSIX process.' : false
}, () => {
    const output = execFileSync('php', [path.resolve('tests/fixtures/transaction-capture-linux.php'), serverRoot], { encoding: 'utf8' });
    assert.match(output, /Linux capture\/rollback checks passed:/);
});

test('environment rollback preserves empty/missing files and captured permissions', () => {
    const result = runCaptureFixture('roundtrip');
    assert.equal(result.same, true);
    assert.equal(result.emptyExists, true);
    assert.equal(result.emptyBytes, '');
    assert.equal(result.missingExists, false);
});

test('environment capture failure precedes backups and all configuration mutation', () => {
    const result = runCaptureFixture('entry-abort');
    assert.equal(result.rejected, true);
    assert.equal(result.unchanged, true);
    assert.deepEqual(result.stages, []);
    assert.equal(result.nativeUnchanged, true);
});

test('environment incomplete rollback reports every failed target and continues restoration', () => {
    const result = runCaptureFixture('rollback-errors');
    assert.match(result.error, /rollback was incomplete.*new-a.*new-b.*present.*mode-file/i);
    assert.equal(result.continued, true);
    assert.equal(result.remaining, true);
    const transaction = runCaptureFixture('entry-rollback');
    assert.match(transaction.error, /Synthetic original apply failure.*rollback was incomplete/i);
    assert.equal(transaction.previous, 'Synthetic original apply failure.');
    assert.equal(transaction.vmRestored, true);
});

const fixture = {
    fv3_export_version: 1,
    plugin_version: '2026.08.01',
    docker: { media: { name: 'Media', containers: ['plex'], regex: '^arr-' }, second: { name: 'Second' } },
    vm: { lab: { name: 'Lab', containers: ['test-vm'] }, second: { name: 'Second VM' } },
    order_docker: { fv3_order_version: 1, entries: ['folder-second', 'folder-media'] },
    order_vm: { fv3_order_version: 1, entries: ['folder-second', 'folder-lab'] },
    custom_styles: {
        'active/example.docker.css': '.fixture-docker { color: red; }',
        'other.disabled/example.dashboard.css': '.fixture-disabled { color: blue; }'
    },
    settings: { default_preview: '2' },
    autostart: { mode: 'custom', sequence: ['plex', 'arr-one'] },
    native_autostart: ['plex 15', 'arr-one']
};

const runHarness = () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-environment-transaction-'));
    const configDir = path.join(tempDir, 'config');
    const sourceDir = path.join(tempDir, 'runtime');
    const documentRoot = path.join(tempDir, 'document-root');
    const storageDir = path.join(tempDir, 'host-storage');
    const nativePath = path.join(storageDir, 'unraid-autostart');
    const bundlePath = path.join(tempDir, 'bundle.json');
    fs.mkdirSync(configDir, { recursive: true });
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.mkdirSync(documentRoot, { recursive: true });
    fs.mkdirSync(storageDir, { recursive: true });
    fs.writeFileSync(bundlePath, JSON.stringify(fixture));
    fs.writeFileSync(nativePath, 'existing 5\n');
    const code = `
        class DockerClient {
            public function getDockerContainers(): array { return []; }
            public function getDockerJSON(string $path): array { return []; }
        }
        $_SERVER['DOCUMENT_ROOT'] = getenv('FVPLUS_TEST_DOCUMENT_ROOT');
        require_once ${phpString(libPath)};
        $initial = normalizeEnvironmentSnapshotPayload([
            'types' => [
                'docker' => ['folders' => ['old-docker' => ['name' => 'Old Docker']], 'prefs' => ['dockerStartOrder' => ['mode' => 'unmanaged']]],
                'vm' => ['folders' => ['old-vm' => ['name' => 'Old VM']], 'prefs' => []]
            ],
            'themeWorkspace' => defaultThemeWorkspace()
        ]);
        applyEnvironmentSnapshotTransaction($initial, 'initial', ['syncDockerOrder' => false]);
        $beforeFailure = exportEnvironmentSnapshotPayload();
        $target = normalizeEnvironmentSnapshotPayload([
            'types' => [
                'docker' => ['folders' => ['new-docker' => ['name' => 'New Docker']], 'prefs' => ['dockerStartOrder' => ['mode' => 'unmanaged']]],
                'vm' => ['folders' => ['new-vm' => ['name' => 'New VM']], 'prefs' => []]
            ],
            'themeWorkspace' => defaultThemeWorkspace()
        ]);
        $failureMessage = '';
        try {
            applyEnvironmentSnapshotTransaction($target, 'failure', [
                'syncDockerOrder' => false,
                'afterStage' => static function(string $stage): void {
                    if ($stage === 'vm-prefs') { throw new RuntimeException('Injected transaction failure.'); }
                }
            ]);
        } catch (RuntimeException $error) { $failureMessage = $error->getMessage(); }
        $afterFailure = exportEnvironmentSnapshotPayload();
        $success = applyEnvironmentSnapshotTransaction($target, 'success', ['syncDockerOrder' => false]);
        $successFolders = ['docker' => readRawFolderMap('docker'), 'vm' => readRawFolderMap('vm')];
        $syncTarget = $target;
        $syncTarget['types']['docker']['prefs']['dockerStartOrder'] = normalizeDockerStartOrderPrefs(['mode' => 'custom-batches']);
        $beforeSyncFailure = exportEnvironmentSnapshotPayload();
        $nativeBeforeSyncFailure = file_get_contents(${phpString(nativePath)});
        $syncFailureMessage = '';
        try {
            applyEnvironmentSnapshotTransaction($syncTarget, 'docker-sync-failure', [
                'afterStage' => static function(string $stage): void {
                    if ($stage === 'docker-order') { throw new RuntimeException('Injected Docker sync failure.'); }
                }
            ]);
        } catch (RuntimeException $error) { $syncFailureMessage = $error->getMessage(); }
        $afterSyncFailure = exportEnvironmentSnapshotPayload();
        $syncNativeRestored = $nativeBeforeSyncFailure === file_get_contents(${phpString(nativePath)});
        $bundle = decodeFolderView3BundlePayloadString(file_get_contents(${phpString(bundlePath)}));
        $digest = (string)buildFolderView3MigrationPlan($bundle, 'fixture.json')['source']['digest'];
        $nativeBeforeExcluded = file_get_contents(${phpString(nativePath)});
        $excluded = applyFolderView3Migration($bundle, 'fixture.json', $digest, false);
        $migrated = exportEnvironmentSnapshotPayload();
        $changedBundle = $bundle;
        $changedBundle['order_vm']['entries'] = array_reverse($changedBundle['order_vm']['entries']);
        $stalePreviewMessage = '';
        try { applyFolderView3Migration($changedBundle, 'fixture.json', $digest, false); }
        catch (RuntimeException $error) { $stalePreviewMessage = $error->getMessage(); }
        $nativeAfterExcluded = file_get_contents(${phpString(nativePath)});
        $included = applyFolderView3Migration($bundle, 'fixture.json', $digest, true);
        $nativeAfterIncluded = file_get_contents(${phpString(nativePath)});
        $beforeExternalFailure = exportEnvironmentSnapshotPayload();
        $nativeBeforeFailure = file_get_contents(${phpString(nativePath)});
        $externalFailureMessage = '';
        try {
            applyFolderView3Migration($bundle, 'fixture.json', $digest, true, [
                'afterStage' => static function(string $stage): void {
                    if ($stage === 'external') { throw new RuntimeException('Injected external failure.'); }
                }
            ]);
        } catch (RuntimeException $error) { $externalFailureMessage = $error->getMessage(); }
        $afterExternalFailure = exportEnvironmentSnapshotPayload();
        echo json_encode([
            'failureMessage' => $failureMessage,
            'failureRestored' => $beforeFailure['types'] === $afterFailure['types'] && $beforeFailure['themeWorkspace'] === $afterFailure['themeWorkspace'],
            'success' => $success,
            'successFolders' => $successFolders,
            'syncFailureMessage' => $syncFailureMessage,
            'syncFailureRestored' => $beforeSyncFailure['types'] === $afterSyncFailure['types'] && $beforeSyncFailure['themeWorkspace'] === $afterSyncFailure['themeWorkspace'],
            'syncNativeRestored' => $syncNativeRestored,
            'excludedUnchanged' => $nativeBeforeExcluded === $nativeAfterExcluded,
            'excludedSelected' => $excluded['nativeAutostartIncluded'],
            'migrated' => $migrated,
            'stalePreviewMessage' => $stalePreviewMessage,
            'includedSelected' => $included['nativeAutostartIncluded'],
            'nativeAfterIncluded' => $nativeAfterIncluded,
            'externalFailureMessage' => $externalFailureMessage,
            'externalFailureRestored' => $beforeExternalFailure['types'] === $afterExternalFailure['types'] && $beforeExternalFailure['themeWorkspace'] === $afterExternalFailure['themeWorkspace'],
            'externalNativeRestored' => $nativeBeforeFailure === file_get_contents(${phpString(nativePath)})
        ], JSON_UNESCAPED_SLASHES);
    `;
    try {
        return JSON.parse(execFileSync('php', ['-r', code], {
            cwd: repoRoot,
            encoding: 'utf8',
            timeout: 120000,
            env: {
                ...process.env,
                FVPLUS_TEST_CONFIG_DIR: configDir,
                FVPLUS_TEST_SOURCE_DIR: sourceDir,
                FVPLUS_TEST_DOCUMENT_ROOT: documentRoot,
                FVPLUS_TEST_STORAGE_DIR: storageDir,
                FVPLUS_TEST_DOCKER_AUTOSTART_FILE: nativePath
            }
        }));
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
};

test('environment transaction restores every prior component after a mid-apply failure', () => {
    const result = runHarness();
    assert.match(result.failureMessage, /Injected transaction failure.*restored/i);
    assert.equal(result.failureRestored, true);
    assert.equal(result.success.verified, true);
    assert.deepEqual(Object.keys(result.successFolders.docker), ['new-docker']);
    assert.deepEqual(Object.keys(result.successFolders.vm), ['new-vm']);
    assert.match(result.syncFailureMessage, /Injected Docker sync failure.*restored/i);
    assert.equal(result.syncFailureRestored, true);
    assert.equal(result.syncNativeRestored, true);
});

test('FolderView3 native autostart stays opt-in and rolls back with configuration', () => {
    const result = runHarness();
    assert.equal(result.excludedUnchanged, true);
    assert.equal(result.excludedSelected, false);
    assert.equal(result.includedSelected, true);
    assert.equal(result.nativeAfterIncluded, 'plex 15\narr-one\n');
    assert.match(result.externalFailureMessage, /Injected external failure.*restored/i);
    assert.equal(result.externalFailureRestored, true);
    assert.equal(result.externalNativeRestored, true);
    assert.deepEqual(result.migrated.types.docker.prefs.manualOrder, ['second', 'media']);
    assert.deepEqual(result.migrated.types.vm.prefs.manualOrder, ['second', 'lab']);
    const imported = result.migrated.themeWorkspace.profiles.find((profile) => profile.name === 'FolderView3 imported appearance');
    const disabled = result.migrated.themeWorkspace.profiles.find((profile) => profile.name === 'FolderView3 disabled appearance 1');
    assert.match(imported.layers.docker.customCss, /fixture-docker/);
    assert.doesNotMatch(JSON.stringify(imported), /fixture-disabled/);
    assert.match(disabled.layers.dashboard.customCss, /fixture-disabled/);
    assert.notEqual(result.migrated.themeWorkspace.activeProfileId, imported.id);
    assert.notEqual(result.migrated.themeWorkspace.activeProfileId, disabled.id);
    assert.match(result.stalePreviewMessage, /changed|preview/i);
});

test('transactional apply uses the configuration lock, readback verification, and exact file rollback', () => {
    const source = fs.readFileSync(path.join(serverRoot, 'lib.environment-transaction.php'), 'utf8');
    assert.match(source, /withConfigMutationLock/);
    assert.match(source, /fvplusEnvironmentVerifyTarget/);
    assert.match(source, /fvplusEnvironmentRestoreFiles\(\$snapshots\)/);
    assert.match(source, /createGlobalRollbackSnapshot/);
    assert.match(source, /createBackupSnapshot/);
});
