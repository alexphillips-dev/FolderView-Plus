<?php
$server = $argv[1]; $root = $argv[2]; $operation = $argv[3] ?? 'rollback';
$_SERVER['DOCUMENT_ROOT'] = $root . '/host';
if ($operation === 'writer') file_put_contents($root . '/writer-started', 'yes');
if ($operation === 'checkpoint-writer') {
    $probe = fopen($root . '/config/.config-mutation.lock', 'c+');
    $locked = flock($probe, LOCK_EX | LOCK_NB);
    if ($locked) flock($probe, LOCK_UN);
    fclose($probe);
    file_put_contents($root . '/writer-started.ready', $locked ? 'unlocked' : 'blocked');
    rename($root . '/writer-started.ready', $root . '/writer-started');
}
class DockerClient {
    public function getDockerContainers(): array { return []; }
    public function getDockerJSON(string $path): array { return []; }
}
if ($operation === 'environment-legacy-markers') {
    define('FVPLUS_LEGACY_CONFIG_DIRS', [$root . '/folder.view2']);
    set_error_handler(static fn(int $level, string $message): bool =>
        $level === E_WARNING && str_contains($message, 'Constant FVPLUS_LEGACY_CONFIG_DIRS already defined'));
}
require $server . '/lib.php';
if ($operation === 'environment-legacy-markers') restore_error_handler();

function seedState(string $label): void {
    foreach (['docker', 'vm'] as $type) {
        writeRawFolderMap($type, [$label => ['name' => $label . ' ' . $type]]);
        writeTypePrefs($type, ['backupSchedule' => ['enabled' => false], 'dockerStartOrder' => ['mode' => 'unmanaged'], 'manualOrder' => [$label]]);
    }
    $workspace = defaultThemeWorkspace();
    $workspace['profiles'][0]['layers']['global']['customCss'] = '.' . $label . ' { opacity: .8; }';
    writeThemeWorkspace($workspace);
}

if (in_array($operation, ['backup-prune-fault', 'checkpoint-collision', 'checkpoint-prune-fault', 'checkpoint-reader', 'export-reader'], true)) {
    $GLOBALS['checkpoint_boundary_root'] = $root;
    $GLOBALS['checkpoint_boundary_pause'] = in_array($operation, ['checkpoint-reader', 'export-reader'], true);
    eval('namespace CheckpointBoundary;
        function gmdate(string $format, ?int $timestamp = null): string {
            return $format === "Ymd-His" ? "20260101-000000" : \\gmdate($format, $timestamp);
        }
        function unlink(string $path): bool {
            return $path === ($GLOBALS["checkpoint_boundary_unlink"] ?? "") ? false : \\unlink($path);
        }
        function readRawFolderMap(string $type): array {
            $value = \\readRawFolderMap($type);
            if ($type === "docker" && !empty($GLOBALS["checkpoint_boundary_pause"])) {
                $GLOBALS["checkpoint_boundary_pause"] = false; $root = $GLOBALS["checkpoint_boundary_root"];
                file_put_contents($root . "/reader-paused", "yes"); $deadline = microtime(true) + 15;
                while (!is_file($root . "/release-reader")) {
                    if (microtime(true) > $deadline) throw new \\RuntimeException("Snapshot barrier timeout.");
                    usleep(10000);
                }
            }
            return $value;
        }');
    if ($operation === 'backup-prune-fault') {
        $body = str_replace('__DIR__', var_export($server, true), file_get_contents($server . '/lib.backup-snapshots.php'));
        eval('namespace CheckpointBoundary; use \\RuntimeException; use \\Throwable;' . substr($body, 5));
        mkdir(getBackupsDirPath(), 0700, true);
        foreach (['new', 'blocked', 'stale', 'safety'] as $index => $reason) {
            $path = getBackupSnapshotPath('vm', "vm-$reason.json");
            writeJsonObjectAtomic($path, ['fixture' => ['name' => 'Fixture']]);
            touch($path, time() - $index * 120);
        }
        $GLOBALS['checkpoint_boundary_unlink'] = getBackupSnapshotPath('vm', 'vm-blocked.json');
        $removed = CheckpointBoundary\pruneBackupSnapshots('vm', 2, ['vm-safety.json']);
        $remaining = array_column(listBackupSnapshots('vm'), 'name');
        echo json_encode(compact('removed', 'remaining'), JSON_THROW_ON_ERROR); exit;
    }
    if ($operation === 'export-reader') {
        $body = str_replace('__DIR__', var_export($server, true), file_get_contents($server . '/lib.environment-snapshot.php'));
        eval('namespace CheckpointBoundary; use \\RuntimeException; use \\Throwable;' . substr($body, 5));
        echo json_encode(CheckpointBoundary\exportEnvironmentSnapshotPayload(), JSON_THROW_ON_ERROR); exit;
    }
    $module = is_file($server . '/lib.global-rollback.php') ? 'lib.global-rollback.php' : 'lib.backup-schedule.php';
    foreach ([$module, 'lib.environment-transaction.php'] as $file) {
        $body = str_replace('__DIR__', var_export($server, true), file_get_contents($server . '/' . $file));
        eval('namespace CheckpointBoundary; use \\RuntimeException; use \\Throwable; use \\DateTimeImmutable; use \\DateTimeZone;' . substr($body, 5));
    }
    if ($operation === 'checkpoint-reader') {
        CheckpointBoundary\createGlobalRollbackSnapshot('concurrent'); echo '{}'; exit;
    }
    if ($operation === 'checkpoint-prune-fault') {
        seedState('target'); $rows = [];
        foreach (['old', 'middle', 'new'] as $index => $reason) {
            $rows[] = CheckpointBoundary\createGlobalRollbackSnapshot($reason);
            touch(getGlobalRollbackSnapshotPath($rows[$index]['name']), time() - 100 + $index);
        }
        $blocked = getGlobalRollbackSnapshotPath($rows[0]['name']);
        $GLOBALS['checkpoint_boundary_unlink'] = $blocked;
        $removed = CheckpointBoundary\pruneGlobalRollbackSnapshots(2);
        echo json_encode(['removed' => $removed, 'blocked' => $rows[0]['name'], 'blockedRetained' => is_file($blocked),
            'remaining' => count(listGlobalRollbackSnapshots())], JSON_THROW_ON_ERROR); exit;
    }
    seedState('target'); $first = CheckpointBoundary\createGlobalRollbackSnapshot('before-global-rollback');
    $firstPath = getGlobalRollbackSnapshotPath($first['name']); $firstHash = hash_file('sha256', $firstPath);
    seedState('current'); $second = CheckpointBoundary\createGlobalRollbackSnapshot('before-global-rollback');
    // Force exact timestamp and filetime ties independently of the host clock precision.
    $secondPath = getGlobalRollbackSnapshotPath($second['name']);
    $secondPayload = json_decode(file_get_contents($secondPath), true);
    $secondPayload['createdAt'] = $first['createdAt'];
    writeJsonObjectAtomic($secondPath, $secondPayload);
    touch($firstPath, time() - 200); touch($secondPath, time() - 200);
    clearstatcache();
    $rows = CheckpointBoundary\listGlobalRollbackSnapshots();
    $unique = $first['name'] !== $second['name'];
    $latestCorrect = ($rows[0]['name'] ?? '') === $second['name'];
    $previousCorrect = ($rows[1]['name'] ?? '') === $first['name'];
    $before = fvplusEnvironmentCaptureFiles(fvplusEnvironmentTransactionPaths([fvplusEnvironmentDockerAutostartPath()]));
    $error = '';
    try {
        CheckpointBoundary\restoreGlobalRollbackSnapshot($first['name'], ['afterStage' => static function (string $stage): void {
            if ($stage === 'docker-folders') throw new RuntimeException('Injected checkpoint collision failure.');
        }]);
    } catch (Throwable $failure) { $error = $failure->getMessage(); }
    echo json_encode(['unique' => $unique, 'latestCorrect' => $latestCorrect, 'previousCorrect' => $previousCorrect,
        'targetBytesRetained' => $firstHash === hash_file('sha256', $firstPath),
        'configRestored' => $before === fvplusEnvironmentCaptureFiles(fvplusEnvironmentTransactionPaths([fvplusEnvironmentDockerAutostartPath()])),
        'error' => $error], JSON_THROW_ON_ERROR); exit;
}
if ($operation === 'checkpoint-writer') {
    withConfigMutationLock(static function (): void { seedState('writer'); });
    file_put_contents($root . '/writer-finished', 'yes'); echo '{}'; exit;
}

if ($operation === 'seed-export') {
    seedState('initial'); echo '{}'; exit;
}
if ($operation === 'export-current') {
    echo json_encode(exportEnvironmentSnapshotPayload(), JSON_THROW_ON_ERROR); exit;
}

if ($operation === 'environment-retention') {
    seedState('older');
    foreach (FVPLUS_ALLOWED_TYPES as $type) {
        writeTypePrefs($type, ['backupSchedule' => ['retention' => 1], 'dockerStartOrder' => ['mode' => 'unmanaged']]);
        $old[$type] = createBackupSnapshot($type, 'manual')['name'];
    }
    $checkpoint = createGlobalRollbackSnapshot('previous-manual-point')['name'];
    for ($index = 1; $index < FVPLUS_GLOBAL_ROLLBACK_HISTORY_MAX; ++$index) {
        copy(getGlobalRollbackSnapshotPath($checkpoint), getGlobalRollbackSnapshotPath("global-20260101-000000-copy-$index.json"));
    }
    $globalBefore = array_column(listGlobalRollbackSnapshots(), 'name');
    foreach (FVPLUS_ALLOWED_TYPES as $type) writeRawFolderMap($type, ['current' => ['name' => 'Current']]);
    $target = exportEnvironmentSnapshotPayload();
    $target['types']['vm']['folders'] = ['target' => ['name' => 'Target']];
    $before = fvplusEnvironmentCaptureFiles(fvplusEnvironmentTransactionPaths());
    $error = '';
    try {
        applyEnvironmentSnapshotTransaction($target, '', ['syncDockerOrder' => false, 'afterStage' => static function (string $stage): void {
            if ($stage === 'verified') throw new RuntimeException('Injected late environment failure.');
        }]);
    } catch (RuntimeException $failure) { $error = $failure->getMessage(); }
    $unchanged = $before === fvplusEnvironmentCaptureFiles(fvplusEnvironmentTransactionPaths());
    $oldTypesPreserved = is_file(getBackupSnapshotPath('docker', $old['docker']))
        && is_file(getBackupSnapshotPath('vm', $old['vm']));
    $oldGlobalsPreserved = array_diff($globalBefore, array_column(listGlobalRollbackSnapshots(), 'name')) === [];
    $result = applyEnvironmentSnapshotTransaction($target, '', ['syncDockerOrder' => false]);
    $afterSuccess = count(listGlobalRollbackSnapshots()) === FVPLUS_GLOBAL_ROLLBACK_HISTORY_MAX
        && is_file(getGlobalRollbackSnapshotPath($result['rollback']['name']));
    foreach (FVPLUS_ALLOWED_TYPES as $type) {
        $afterSuccess = $afterSuccess && count(listBackupSnapshots($type)) === 1
            && is_file(getBackupSnapshotPath($type, $result['types'][$type]['backup']['name']));
    }
    echo json_encode(compact('error', 'unchanged', 'oldTypesPreserved', 'oldGlobalsPreserved', 'afterSuccess'), JSON_THROW_ON_ERROR); exit;
}

if ($operation === 'environment-legacy-markers') {
    $legacy = $root . '/folder.view2';
    mkdir($legacy, 0700);
    file_put_contents($legacy . '/vm.json', json_encode(['legacy' => ['name' => 'Legacy VM folder']]));
    file_put_contents($legacy . '/vm.prefs.json', json_encode(['groupUnassignedItems' => true]));
    $target = ['types' => ['docker' => ['folders' => []], 'vm' => ['folders' => ['target' => ['name' => 'Target']]]]];
    $before = fvplusEnvironmentCaptureFiles(fvplusEnvironmentTransactionPaths());
    $error = '';
    try {
        applyEnvironmentSnapshotTransaction($target, '', ['syncDockerOrder' => false, 'afterStage' => static function (string $stage): void {
            if ($stage === 'vm-prefs') throw new RuntimeException('Injected legacy environment failure.');
        }]);
    } catch (RuntimeException $failure) { $error = $failure->getMessage(); }
    $unchanged = $before === fvplusEnvironmentCaptureFiles(fvplusEnvironmentTransactionPaths());
    $noMarkers = !is_file(getLegacyMigrationMarkerPath('vm', 'folders')) && !is_file(getLegacyMigrationMarkerPath('vm', 'prefs'));
    $legacyFolders = array_keys(readRawFolderMap('vm'));
    $legacyPrefs = readTypePrefs('vm')['groupUnassignedItems'];
    echo json_encode(compact('error', 'unchanged', 'noMarkers', 'legacyFolders', 'legacyPrefs'), JSON_THROW_ON_ERROR); exit;
}

if ($operation === 'rollback') {
    seedState('target'); $target = createGlobalRollbackSnapshot('fixture-target');
    $targetPath = getGlobalRollbackSnapshotPath($target['name']); touch($targetPath, time() - 300);
    // Fill retention so the selected oldest checkpoint would be pruned without protection.
    for ($index = 0; $index < FVPLUS_GLOBAL_ROLLBACK_HISTORY_MAX - 1; $index++) {
        $path = getGlobalRollbackSnapshotPath('global-20260101-000000-fill-' . $index . '.json');
        copy($targetPath, $path); touch($path, time() - 100 + $index);
    }
    seedState('current');
    file_put_contents(fvplusEnvironmentDockerAutostartPath(), "current-native 5\n");
    $capture = static fn(): array => fvplusEnvironmentCaptureFiles(fvplusEnvironmentTransactionPaths([fvplusEnvironmentDockerAutostartPath()]));
    $results = [];
    foreach (['captured', 'docker-folders', 'docker-prefs', 'vm-folders', 'vm-prefs', 'theme-workspace', 'docker-order', 'verified', 'readback'] as $stage) {
        $before = $capture(); $error = '';
        try {
            restoreGlobalRollbackSnapshot($target['name'], ['afterStage' => static function (string $actual) use ($stage): void {
                if ($stage === 'readback' && $actual === 'theme-workspace') {
                    writeRawFolderMap('docker', ['tampered' => ['name' => 'Tampered']]);
                } elseif ($actual === $stage) {
                    throw new RuntimeException('Injected global rollback ' . $stage . '.');
                }
            }]);
        } catch (Throwable $failure) { $error = $failure->getMessage(); }
        $results[$stage] = ['error' => $error, 'exactRestored' => $before === $capture(), 'targetRetained' => is_file($targetPath)];
    }
    $results['success'] = restoreGlobalRollbackSnapshot($target['name']);
    $results['targetApplied'] = array_keys(readRawFolderMap('docker')) === ['target']
        && array_keys(readRawFolderMap('vm')) === ['target'];
    $results['nativePreserved'] = file_get_contents(fvplusEnvironmentDockerAutostartPath()) === "current-native 5\n";
    $results['retention'] = count(listGlobalRollbackSnapshots());
    echo json_encode($results, JSON_THROW_ON_ERROR); exit;
}
if ($operation === 'envelopes') {
    seedState('current'); $valid = exportEnvironmentSnapshotPayload();
    $cases = [];
    $cases['wrong-kind'] = array_replace($valid, ['kind' => 'wrong']);
    $cases['future-schema'] = array_replace($valid, ['schemaVersion' => 999]);
    $cases['string-schema'] = array_replace($valid, ['schemaVersion' => '1']);
    $cases['missing-kind'] = $valid; unset($cases['missing-kind']['kind']);
    $cases['missing-type'] = $valid; unset($cases['missing-type']['types']['vm']);
    $cases['missing-folders'] = $valid; unset($cases['missing-folders']['types']['vm']['folders']);
    $cases['invalid-folders'] = $valid; $cases['invalid-folders']['types']['vm']['folders'] = 'bad';
    $cases['invalid-folder-record'] = $valid; $cases['invalid-folder-record']['types']['vm']['folders'] = ['bad' => null];
    $cases['invalid-folder-id'] = $valid; $cases['invalid-folder-id']['types']['vm']['folders'] = ['bad folder id' => ['name' => 'Bad']];
    $cases['duplicate-folder-id'] = $valid; $cases['duplicate-folder-id']['types']['vm']['folders'] = ['x' => [], ' x ' => []];
    $cases['invalid-membership'] = $valid; $cases['invalid-membership']['types']['vm']['folders'] = ['x' => ['containers' => [['bad']]]];
    $cases['missing-prefs'] = $valid; unset($cases['missing-prefs']['types']['docker']['prefs']);
    $cases['invalid-prefs'] = $valid; $cases['invalid-prefs']['types']['docker']['prefs'] = 'bad';
    $cases['missing-theme'] = $valid; unset($cases['missing-theme']['themeWorkspace']);
    $capture = static fn(): array => fvplusEnvironmentCaptureFiles(fvplusEnvironmentTransactionPaths());
    $results = [];
    foreach ($cases as $name => $payload) {
        $before = $capture(); $results[$name] = [];
        foreach (['decode', 'preview', 'import'] as $entry) {
            $error = '';
            try {
                if ($entry === 'decode') decodeEnvironmentSnapshotPayloadString(json_encode($payload));
                elseif ($entry === 'preview') previewEnvironmentSnapshotPayload($payload);
                else importEnvironmentSnapshotPayload($payload);
            } catch (Throwable $failure) { $error = $failure->getMessage(); }
            $results[$name][$entry] = ['rejected' => $error !== '', 'unchanged' => $before === $capture()];
        }
    }
    $results['validRoundtrip'] = decodeEnvironmentSnapshotPayloadString(json_encode($valid)) === $valid;
    $results['internalPartialAccepted'] = count(normalizeEnvironmentSnapshotPayload(['types' => ['docker' => ['folders' => []]]])['types']) === 2;
    $checkpoint = createGlobalRollbackSnapshot('invalid-folder-fixture')['name'];
    $path = getGlobalRollbackSnapshotPath($checkpoint);
    $saved = readJsonObjectFile($path);
    foreach (['invalid-folder-record', 'invalid-folder-id', 'duplicate-folder-id', 'invalid-membership'] as $name) {
        $malformed = $saved;
        $malformed['types']['vm']['folders'] = $cases[$name]['types']['vm']['folders'];
        writeJsonObjectAtomic($path, $malformed);
        $before = $capture(); $backupNames = array_column(listGlobalRollbackSnapshots(), 'name');
        $error = '';
        try { restoreLatestGlobalRollbackSnapshot(); }
        catch (RuntimeException $failure) { $error = $failure->getMessage(); }
        $results[$name]['global-rollback'] = ['rejected' => $error !== '',
            'unchanged' => $before === $capture() && $backupNames === array_column(listGlobalRollbackSnapshots(), 'name')];
    }
    echo json_encode($results, JSON_THROW_ON_ERROR); exit;
}
if ($operation === 'seed-read') {
    seedState('initial');
    file_put_contents(getFolderFilePath('docker'), '{"old":{"name":"Old"}}');
    file_put_contents(getTypePrefsPath('docker'), '{"sortMode":"manual"}');
    file_put_contents(getThemeWorkspacePath(), '{"variables":{},"customCss":".old {}"}');
    echo '{}'; exit;
}
$kind = $argv[4];
if ($operation === 'writer') {
    if ($kind === 'folders') writeRawFolderMap('docker', ['current' => ['name' => 'Current']]);
    elseif ($kind === 'prefs') writeTypePrefs('docker', ['sortMode' => 'alpha']);
    else { $workspace = defaultThemeWorkspace(); $workspace['profiles'][0]['layers']['global']['customCss'] = '.current {}'; writeThemeWorkspace($workspace); }
    file_put_contents($root . '/writer-finished', 'yes'); echo '{}'; exit;
}
if ($operation === 'reader') {
    $GLOBALS['boundary_root'] = $root;
    eval('namespace ReadBoundary; function pauseRead(): void {
        static $paused = false; if ($paused) return; $paused = true;
        $root = $GLOBALS["boundary_root"]; file_put_contents($root . "/reader-paused", "yes");
        $deadline = microtime(true) + 15;
        while (!is_file($root . "/release-reader")) { if (microtime(true) > $deadline) throw new \\RuntimeException("Reader barrier timeout."); usleep(10000); }
    }
    function normalizeFolderMapPayload($value): array { pauseRead(); return \\normalizeFolderMapPayload($value); }
    function normalizeTypePrefs($value): array { pauseRead(); return \\normalizeTypePrefs($value); }
    function normalizeThemeWorkspacePayload($value): array { pauseRead(); return \\normalizeThemeWorkspacePayload($value); }');
    $file = ['folders' => 'lib.php', 'prefs' => 'lib.prefs.php', 'theme' => 'lib.theme-workspace.php'][$kind];
    $function = ['folders' => 'readRawFolderMap', 'prefs' => 'readTypePrefs', 'theme' => 'readThemeWorkspace'][$kind];
    preg_match('/    function ' . $function . '\([^\n]+\{[\s\S]*?\n    \}/', file_get_contents($server . '/' . $file), $matches);
    eval('namespace ReadBoundary; use \\RuntimeException; use \\Throwable;' . $matches[0]);
    call_user_func('ReadBoundary\\' . $function, 'docker');
    echo '{}'; exit;
}
if ($operation === 'read-final') {
    $current = $kind === 'folders' ? array_keys(readRawFolderMap('docker')) === ['current']
        : ($kind === 'prefs' ? readTypePrefs('docker')['sortMode'] === 'alpha'
            : strpos(json_encode(readThemeWorkspace()), '.current {}') !== false);
    echo json_encode(['current' => $current]); exit;
}
throw new RuntimeException('Unsupported fixture operation.');
