import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const server = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server');
const quote = value => `'${String(value).replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;

const exerciseRestore = type => {
    const base = fs.realpathSync(os.tmpdir());
    const temp = fs.mkdtempSync(path.join(base, 'fvplus-recovery-'));
    const documentRoot = path.join(temp, 'host');
    fs.mkdirSync(documentRoot);
    fs.mkdirSync(path.join(temp, 'config'));
    const native = path.join(temp, 'config', 'autostart');
    fs.writeFileSync(native, 'fixture-b 5\nfixture-a 10\n');
    const code = `
class DockerClient {
    public function getDockerContainers(): array { return []; }
    public function getDockerJSON(string $path): array { return []; }
}
$_SERVER['DOCUMENT_ROOT'] = getenv('FVPLUS_TEST_DOCUMENT_ROOT');
require ${quote(path.join(server, 'lib.php'))};
$type = ${quote(type)}; $other = $type === 'docker' ? 'vm' : 'docker';
writeRawFolderMap($other, ['unrelated' => ['name' => 'Unrelated']]);
writeTypePrefs($other, defaultTypePrefs());
$otherBefore = [readRawFolderMap($other), readTypePrefs($other), readConfigMetadata($other, false)];
$savedFolders = normalizeFolderMapPayload([
    'alpha' => ['name' => 'Saved alpha', 'containers' => ['fixture-a']],
    'beta' => ['name' => 'Saved beta', 'containers' => ['fixture-b'], 'parentId' => 'alpha']
]);
$savedPrefs = normalizeTypePrefs([
    'sortMode' => 'manual', 'manualOrder' => ['beta', 'alpha'], 'pinnedFolderIds' => ['alpha'],
    'hiddenFolderIds' => ['beta'], 'hideEmptyFolders' => true,
    'autoRules' => [['id' => 'rule-fixture', 'folderId' => 'alpha', 'kind' => 'name_regex', 'pattern' => '^fixture', 'enabled' => true]],
    'dashboard' => ['layout' => 'compactmatrix'], 'backupSchedule' => ['retention' => 1]
]);
$currentFolders = normalizeFolderMapPayload(['current' => ['name' => 'Current folder']]);
$currentPrefs = normalizeTypePrefs(['sortMode' => 'alpha', 'hideEmptyFolders' => false, 'backupSchedule' => ['retention' => 1]]);
function seedFixture(string $type, array $folders, array $prefs): void {
    foreach (listBackupSnapshots($type) as $entry) { unlink(getBackupSnapshotPath($type, $entry['name'])); }
    writeRawFolderMap($type, $folders); writeTypePrefs($type, $prefs);
}
function captureFixture(string $type): array {
    $paths = [];
    foreach ([getFolderFilePath($type), getTypePrefsPath($type), getConfigMetadataPath($type)] as $file) {
        $paths[] = $file; $paths[] = getLastGoodJsonPath($file);
    }
    $paths[] = fvplusEnvironmentDockerAutostartPath();
    return fvplusEnvironmentCaptureFiles($paths);
}
$result = [];
foreach (['named', 'latest', 'undo'] as $mode) {
    seedFixture($type, $savedFolders, $savedPrefs);
    $target = createBackupSnapshot($type, $mode === 'undo' ? 'before-prefs-update' : 'manual');
    touch(getBackupSnapshotPath($type, $target['name']), time() - 120);
    writeRawFolderMap($type, $currentFolders); writeTypePrefs($type, $currentPrefs);
    $revisionBefore = readConfigMetadata($type, false);
    $restore = $mode === 'latest' ? restoreLatestBackupSnapshot($type)
        : ($mode === 'undo' ? restoreLatestUndoBackupSnapshot($type)
            : restoreBackupSnapshot($type, $target['name'], ['createSafetyBackup' => true]));
    $revisionAfter = readConfigMetadata($type, false);
    $result[$mode] = [
        'targetRestored' => $restore['name'] === $target['name'],
        'foldersRestored' => readRawFolderMap($type) === $savedFolders,
        'prefsRestored' => readTypePrefs($type) === $savedPrefs,
        'newRevision' => $revisionAfter['folderRevision'] > $revisionBefore['folderRevision'] && $revisionAfter['prefsRevision'] > $revisionBefore['prefsRevision']
    ];
    if ($mode !== 'undo') {
        $backup = $restore['backup'] ?? [];
        $result[$mode]['safetyExists'] = !empty($backup['name']) && is_file(getBackupSnapshotPath($type, $backup['name']));
        $result[$mode]['retainedCount'] = count(listBackupSnapshots($type));
        if ($result[$mode]['safetyExists']) {
            restoreBackupSnapshot($type, $backup['name']);
            $result[$mode]['undoRestoredCurrent'] = readRawFolderMap($type) === $currentFolders && readTypePrefs($type) === $currentPrefs;
        }
    }
}
seedFixture($type, $currentFolders, $currentPrefs);
$legacy = $type . '-legacy.json';
writeJsonObjectAtomic(getBackupSnapshotPath($type, $legacy), $savedFolders);
restoreBackupSnapshot($type, $legacy);
$result['legacy'] = readRawFolderMap($type) === $savedFolders && readTypePrefs($type) === $currentPrefs;
seedFixture($type, [], $currentPrefs);
$empty = createBackupSnapshot($type, 'before-import-empty');
writeRawFolderMap($type, $savedFolders);
restoreBackupSnapshot($type, $empty['name']);
$result['emptyUndo'] = count(readRawFolderMap($type)) === 0;
seedFixture($type, $savedFolders, $savedPrefs);
$target = createBackupSnapshot($type, 'manual');
writeRawFolderMap($type, []);
$restore = restoreBackupSnapshot($type, $target['name'], ['createSafetyBackup' => true]);
$emptySafety = $restore['backup'] ?? [];
$result['emptySafety'] = !empty($emptySafety['name']) && readBackupSnapshot($type, $emptySafety['name'])['count'] === 0;
seedFixture($type, $savedFolders, $savedPrefs);
$target = createBackupSnapshot($type, 'manual');
touch(getBackupSnapshotPath($type, $target['name']), time() - 120);
writeRawFolderMap($type, []);
writeTypePrefs($type, array_replace_recursive($currentPrefs, ['backupSchedule' => ['retention' => 25]]));
createBackupSnapshot($type, 'before-import-empty');
writeRawFolderMap($type, $currentFolders);
$restore = restoreLatestBackupSnapshot($type);
$result['latestSkipsEmpty'] = $restore['name'] === $target['name'] && readRawFolderMap($type) === $savedFolders;
foreach (['folders', 'prefs', 'docker-order'] as $stage) {
    if ($stage === 'docker-order' && $type !== 'docker') continue;
    seedFixture($type, $savedFolders, $savedPrefs);
    $target = createBackupSnapshot($type, 'manual');
    writeRawFolderMap($type, $currentFolders); writeTypePrefs($type, $currentPrefs);
    $before = captureFixture($type); $error = '';
    try {
        restoreBackupSnapshot($type, $target['name'], ['createSafetyBackup' => true,
            'afterStage' => static function(string $actual) use ($stage): void {
                if ($actual === $stage) {
                    if ($actual === 'docker-order') writeDurableFileAtomic(fvplusEnvironmentDockerAutostartPath(), 'injected-change');
                    throw new RuntimeException('Injected restore failure.');
                }
            }
        ]);
    } catch (Throwable $failure) { $error = $failure->getMessage(); }
    $result['failures'][$stage] = ['error' => $error, 'unchanged' => $before === captureFixture($type),
        'targetRetained' => is_file(getBackupSnapshotPath($type, $target['name']))];
}
foreach (['invalid-json', 'missing-folders', 'invalid-prefs', 'wrong-type'] as $kind) {
    seedFixture($type, $currentFolders, $currentPrefs);
    $name = $type . '-invalid.json';
    $payload = ['schemaVersion' => 1, 'type' => $type, 'folders' => $savedFolders, 'prefs' => $savedPrefs];
    if ($kind === 'missing-folders') unset($payload['folders']);
    if ($kind === 'invalid-prefs') $payload['prefs'] = 'invalid';
    if ($kind === 'wrong-type') $payload['type'] = $other;
    file_put_contents(getBackupSnapshotPath($type, $name), $kind === 'invalid-json' ? '{' : json_encode($payload));
    $before = captureFixture($type); $rejected = false;
    try { restoreBackupSnapshot($type, $name, ['createSafetyBackup' => true]); }
    catch (Throwable $failure) { $rejected = true; }
    $result['invalid'][$kind] = $rejected && $before === captureFixture($type) && count(listBackupSnapshots($type)) === 1;
}
$result['otherUnchanged'] = $otherBefore === [readRawFolderMap($other), readTypePrefs($other), readConfigMetadata($other, false)];
echo json_encode($result);
`;
    try {
        return JSON.parse(execFileSync('php', ['-r', code], { encoding: 'utf8', timeout: 30000, env: {
            ...process.env, FVPLUS_TEST_CONFIG_DIR: path.join(temp, 'config'),
            FVPLUS_TEST_SOURCE_DIR: path.join(temp, 'runtime'), FVPLUS_TEST_DOCUMENT_ROOT: documentRoot,
            FVPLUS_TEST_DOCKER_AUTOSTART_FILE: native
        } }));
    } finally {
        const target = fs.realpathSync(temp);
        assert.equal(path.dirname(target), base);
        assert.ok(path.basename(target).startsWith('fvplus-recovery-'));
        fs.rmSync(target, { recursive: true, force: true });
    }
};

for (const type of ['docker', 'vm']) {
    test(`${type} real PHP restore round-trips preferences, protects retention, and rolls back failures`, () => {
        const result = exerciseRestore(type);
        for (const mode of ['named', 'latest', 'undo']) {
            assert.equal(result[mode].targetRestored, true, `${mode}: wrong restore target`);
            assert.equal(result[mode].foldersRestored, true, `${mode}: folders not restored`);
            assert.equal(result[mode].prefsRestored, true, `${mode}: preferences not restored`);
            assert.equal(result[mode].newRevision, true, `${mode}: revisions did not advance`);
            if (mode !== 'undo') {
                assert.equal(result[mode].safetyExists, true, `${mode}: undo backup missing`);
                assert.equal(result[mode].retainedCount, 1, `${mode}: retention not applied after restore`);
                assert.equal(result[mode].undoRestoredCurrent, true, `${mode}: safety backup cannot undo restore`);
            }
        }
        assert.equal(result.legacy, true, 'folder-only legacy backup changed preferences');
        assert.equal(result.emptyUndo, true, 'explicit empty snapshot did not restore empty state');
        assert.equal(result.emptySafety, true, 'empty current state was not protected');
        assert.equal(result.latestSkipsEmpty, true, 'latest restore selected an empty snapshot');
        assert.equal(result.otherUnchanged, true, 'restore changed the other source');
        for (const [stage, failure] of Object.entries(result.failures)) {
            assert.match(failure.error, /Injected restore failure/, stage);
            assert.equal(failure.unchanged, true, `${stage}: rollback did not restore exact files`);
            assert.equal(failure.targetRetained, true, `${stage}: failed restore pruned target`);
        }
        for (const [kind, rejected] of Object.entries(result.invalid)) assert.equal(rejected, true, kind);
    });
}
