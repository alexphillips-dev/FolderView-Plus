<?php
// This fixture only runs with isolated config/source/host directories supplied by Node.
$_SERVER['DOCUMENT_ROOT'] = getenv('FVPLUS_TEST_DOCUMENT_ROOT');
require_once $argv[1] . '/lib.php';
$request = json_decode(file_get_contents($argv[2]), true);
$type = ensureType($request['type'] ?? 'docker');
function fixtureDue(string $type): void {
    $state = readBackupScheduleState();
    if (isset($state['types'][$type])) $state['types'][$type]['lastRunAt'] = gmdate('c', time() - 7200);
    writeJsonObjectAtomic(backupScheduleStatePath(), $state);
}
function fixtureConfigFiles(): array {
    global $configDir;
    $files = [];
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($configDir, FilesystemIterator::SKIP_DOTS));
    foreach ($iterator as $file) if ($file->isFile()) $files[substr($file->getPathname(), strlen($configDir))] = hash_file('sha256', $file->getPathname());
    ksort($files);
    return $files;
}
if (($request['operation'] ?? '') === 'run') {
    runScheduledBackups($type);
    echo json_encode(readBackupScheduleState());
    exit;
}
if (($request['operation'] ?? '') === 'history') {
    echo json_encode(readDiagnosticsHistoryEvents(250));
    exit;
}
writeRawFolderMap($type, ['first' => ['name' => 'Private fixture folder', 'containers' => []], 'second' => ['name' => 'Second', 'containers' => []]]);
writeTypePrefs($type, defaultTypePrefs());
$baseline = createBackupSnapshot($type, 'manual');
$baselineName = "$type-20000101-000000-manual.json";
rename(getBackupSnapshotPath($type, $baseline['name']), getBackupSnapshotPath($type, $baselineName));
touch(getBackupSnapshotPath($type, $baselineName), time() - 172800);
readRawFolderMap($type); readTypePrefs($type); readConfigMetadata($type, true);
$scenario = $request['scenario'] ?? 'unchanged';
if ($scenario === 'empty') writeRawFolderMap($type, []);
if ($scenario === 'folders') {
    $folders = readRawFolderMap($type); $folders['first']['name'] = 'Changed'; writeRawFolderMap($type, $folders);
}
if ($scenario === 'order') writeRawFolderMap($type, array_reverse(readRawFolderMap($type), true));
if ($scenario === 'prefs') { $prefs = readTypePrefs($type); $prefs['hideEmptyFolders'] = true; writeTypePrefs($type, $prefs); }
if ($scenario === 'bookkeeping') { $prefs = readTypePrefs($type); $prefs['backupSchedule']['lastRunAt'] = gmdate('c'); writeTypePrefs($type, $prefs); }
if ($scenario === 'missing') unlink(getBackupSnapshotPath($type, $baselineName));
if ($scenario === 'corrupt') file_put_contents(getBackupSnapshotPath($type, $baselineName), '{invalid');
if (in_array($scenario, ['wrong-type', 'schema', 'partial'], true)) {
    $path = getBackupSnapshotPath($type, $baselineName); $payload = readJsonObjectFile($path);
    if ($scenario === 'wrong-type') $payload['type'] = $type === 'docker' ? 'vm' : 'docker';
    if ($scenario === 'schema') $payload['schemaVersion'] = 999;
    if ($scenario === 'partial') unset($payload['prefs']);
    writeJsonObjectAtomic($path, $payload);
}
if ($scenario === 'disabled') { $prefs = readTypePrefs($type); $prefs['backupSchedule']['enabled'] = false; writeTypePrefs($type, $prefs); }
if ($scenario === 'seed') { echo json_encode(['baseline' => $baselineName]); exit; }
$before = fixtureConfigFiles();
$failure = '';
if ($scenario === 'failure') { unlink(getBackupSnapshotPath($type, $baselineName)); putenv('FVPLUS_STORAGE_FAILURE_INJECTION=1'); putenv('FVPLUS_STORAGE_FAILURE_STAGE=rename'); }
try { runScheduledBackups($type); } catch (Throwable $error) { $failure = $error->getMessage(); }
putenv('FVPLUS_STORAGE_FAILURE_INJECTION=0');
$first = readBackupScheduleState();
$after = fixtureConfigFiles();
runScheduledBackups($type);
$afterImmediate = readBackupScheduleState();
if (in_array($scenario, ['unchanged', 'folders', 'prefs', 'order', 'restart', 'missing-after-skip', 'future', 'interval-change'], true)) {
    if ($scenario === 'restart') unlink(backupScheduleStatePath());
    elseif ($scenario === 'future') { $state = readBackupScheduleState(); $state['types'][$type]['lastRunAt'] = gmdate('c', time() + 7200); writeJsonObjectAtomic(backupScheduleStatePath(), $state); }
    elseif ($scenario === 'interval-change') { $prefs = readTypePrefs($type); $prefs['backupSchedule']['intervalHours'] = 2; writeTypePrefs($type, $prefs); }
    else fixtureDue($type);
    if ($scenario === 'missing-after-skip') unlink(getBackupSnapshotPath($type, $baselineName));
    runScheduledBackups($type);
}
$manual = null;
if ($scenario === 'manual') $manual = createBackupSnapshot($type, 'manual-explicit');
if ($scenario === 'restore') $manual = restoreBackupSnapshot($type, $baselineName, ['createSafetyBackup' => true])['backup'];
$backups = listBackupSnapshots($type);
$schedule = getTypeBackupSchedule($type);
$data = [$type => ['folderCount' => count(readRawFolderMap($type)), 'lastBackup' => $backups[0] ?? null, 'backupSchedule' => $schedule]];
$events = readDiagnosticsHistoryEvents(250);
echo json_encode(['before' => $before, 'after' => $after, 'first' => $first, 'afterImmediate' => $afterImmediate,
    'state' => readBackupScheduleState(), 'backups' => $backups, 'schedule' => $schedule, 'manual' => $manual, 'failure' => $failure,
    'events' => $events, 'timeline' => buildDiagnosticsTimeline($events, 250),
    'health' => diagnosticsBackupReadiness($data)[$type], 'stoppedHealth' => diagnosticsBackupReadiness($data, time() + 14400)[$type]]);
