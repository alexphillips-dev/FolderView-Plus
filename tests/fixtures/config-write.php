<?php
namespace ConfigWriteFault {
    // Real source and filesystem writes; faults are confined to I/O boundaries.
    function tempnam(string $directory, string $prefix) {
        $path = \tempnam($directory, $prefix);
        if (is_string($path)) $GLOBALS['config_write_temps'][$path] = $prefix;
        return $path;
    }
    function rename(string $from, string $to): bool {
        $fault = &$GLOBALS['config_write_fault'];
        $base = basename($to);
        if ($base === $fault['payload']) {
            if (!empty($fault['failed']) && !empty($fault['rollback'])) return false;
            if (!empty($fault['enabled']) && $fault['stage'] === 'primary-rename') return false;
            $ok = \rename($from, $to);
            if ($ok && !empty($fault['enabled'])) {
                $fault['primaryCommitted'] = true;
                if (!empty($fault['readOnlyAfterPrimary'])) {
                    $fault['observed'] = fixtureState($fault['root'], $fault['type']);
                    \chmod($fault['root'] . '/config', 0555);
                }
            }
            return $ok;
        }
        if ($base === $fault['metadata'] && !empty($fault['enabled']) && !empty($fault['primaryCommitted']) && $fault['stage'] === 'metadata-rename') {
            $fault['failed'] = true;
            $fault['enabled'] = false; // Compensation runs through the real writer.
            $fault['observed'] = fixtureState($fault['root'], $fault['type']);
            if (!empty($fault['pause'])) {
                \file_put_contents($fault['root'] . '/paused', 'locked');
                $deadline = microtime(true) + 10;
                while (!\file_exists($fault['root'] . '/release') && microtime(true) < $deadline) {
                    usleep(10000); \clearstatcache(true, $fault['root'] . '/release');
                }
                if (!\file_exists($fault['root'] . '/release')) throw new \RuntimeException('Fixture barrier timed out.');
            }
            if (!empty($fault['rollback'])) {
                putenv('FVPLUS_STORAGE_FAILURE_INJECTION=1');
                putenv('FVPLUS_STORAGE_FAILURE_STAGE=rename');
            }
            // Exercise an actual OS rename failure, without replacing the sidecar.
            return \rename($from, $fault['root'] . '/rename-denied');
        }
        if (!empty($fault['mirrors']) && str_ends_with($base, '.lastgood')) return false;
        return \rename($from, $to);
    }
    function fopen(string $path, string $mode) {
        $fault = &$GLOBALS['config_write_fault'];
        if (!empty($fault['enabled']) && !empty($fault['primaryCommitted']) && $fault['stage'] === 'metadata-open'
            && ($GLOBALS['config_write_temps'][$path] ?? '') === $fault['metadata'] . '.tmp.') {
            $fault['observed'] = fixtureState($fault['root'], $fault['type']);
            $fault['failed'] = true; $fault['enabled'] = false;
            return false;
        }
        return \fopen($path, $mode);
    }
    function readInfo(string $type): array { return ['fixture-member' => []]; }
    function syncContainerOrder(string $type): void {}
    function fixtureState(string $root, string $type): array {
        $state = [];
        foreach (['.json', '.json.lastgood', '.prefs.json', '.prefs.json.lastgood', '.metadata.json', '.metadata.json.lastgood'] as $suffix) {
            $path = "$root/config/$type$suffix";
            clearstatcache(true, $path);
            $state[$suffix] = is_file($path) ? [base64_encode(\file_get_contents($path)), \fileperms($path) & 0777] : null;
        }
        return $state;
    }
}
namespace {
    function fvplus_assert_folder_payload_shape(array $payload): void {}
    $server = $argv[1]; $root = $argv[2];
    $_SERVER['DOCUMENT_ROOT'] = getenv('FVPLUS_TEST_DOCUMENT_ROOT');
    $request = json_decode(file_get_contents($argv[3] ?? "$root/request.json"), true, 512, JSON_THROW_ON_ERROR);
    if (!empty($request['contender'])) {
        $probe = fopen("$root/config/.config-mutation.lock", 'c+');
        $locked = flock($probe, LOCK_EX | LOCK_NB);
        if ($locked) flock($probe, LOCK_UN);
        fclose($probe);
        file_put_contents("$root/contender-started", $locked ? 'unlocked' : 'blocked');
    }
    require "$server/lib.php";
    require "$server/lib.i18n.php";
    require "$server/lib.runtime-snapshot.php";
    $type = $request['type'] ?? 'vm'; $kind = $request['kind'] ?? 'folder';
    $GLOBALS['config_write_fault'] = ['root' => $root, 'type' => $type, 'payload' => "$type" . ($kind === 'prefs' ? '.prefs' : '') . '.json',
        'metadata' => "$type.metadata.json", 'stage' => $request['stage'] ?? 'metadata-rename', 'enabled' => false];
    function fixtureEval(string $source): void {
        eval('namespace ConfigWriteFault; use \\RuntimeException; use \\Throwable; use \\FVPlusConfigConflictException;' . $source);
    }
    // Extract complete definitions with PHP's tokenizer, including nested closures.
    function fixtureFunction(string $source, string $name): string {
        $tokens = token_get_all($source);
        for ($i = 0; $i < count($tokens); $i++) {
            if (!is_array($tokens[$i]) || $tokens[$i][0] !== T_FUNCTION) continue;
            $start = $i;
            do { $i++; } while (is_array($tokens[$i]) && $tokens[$i][0] === T_WHITESPACE);
            if (!is_array($tokens[$i]) || $tokens[$i][1] !== $name) continue;
            $definition = 'function'; $depth = 0; $opened = false;
            for ($j = $start + 1; $j < count($tokens); $j++) {
                $token = $tokens[$j]; $text = is_array($token) ? $token[1] : $token;
                $definition .= $text;
                if ($token === '{') { $depth++; $opened = true; }
                if ($token === '}' && --$depth === 0 && $opened) return $definition;
            }
        }
        throw new RuntimeException("Missing fixture function: $name");
    }
    foreach (['lib.storage.php', 'lib.transaction-files.php', 'lib.config-write.php', 'lib.folder-mutations.php', 'lib.folder-rules.php',
        'lib.environment-transaction.php', 'lib.backup-restore.php'] as $file) {
        if (is_file("$server/$file")) fixtureEval(substr(file_get_contents("$server/$file"), 5));
    }
    fixtureEval(fixtureFunction(file_get_contents("$server/lib.php"), 'writeRawFolderMap'));
    fixtureEval(fixtureFunction(file_get_contents("$server/lib.prefs.php"), 'writeTypePrefs'));
    if (!is_dir("$root/rename-denied")) mkdir("$root/rename-denied");
    file_put_contents("$root/rename-denied/sentinel", 'keep');
    $old = ['old' => ['name' => 'Old fixture', 'containers' => ['fixture-member']]];
    if (($request['operation'] ?? '') === 'bulk') $old['target'] = ['name' => 'Target fixture', 'containers' => []];
    $prefs = normalizeTypePrefs(['sortMode' => 'manual', 'manualOrder' => ['old'], 'backupSchedule' => ['enabled' => false]]);
    $operation = $request['operation'] ?? 'writer';
    if (empty($request['first']) && empty($request['skipSeed'])) {
        foreach (['docker', 'vm'] as $seedType) {
            \ConfigWriteFault\writeRawFolderMap($seedType, $old);
            \ConfigWriteFault\writeTypePrefs($seedType, $prefs);
        }
    }
    if (!empty($request['seedOnly'])) { echo '{}'; exit; }
    $backupName = '';
    if ($operation === 'backup') {
        $backupName = createBackupSnapshot($type, 'fixture')['name'];
        \ConfigWriteFault\writeRawFolderMap($type, ['current' => ['name' => 'Current fixture']]);
    }
    if ($operation === 'environment') writeThemeWorkspace(defaultThemeWorkspace());
    if (!empty($request['external'])) file_put_contents(getFolderFilePath($type), json_encode(['external' => ['name' => 'External fixture']]));
    if (!empty($request['corruptMetadata'])) file_put_contents(getConfigMetadataPath($type), '{corrupt fixture');
    if (!empty($request['modes'])) {
        chmod(getFolderFilePath($type), 0600); chmod(getTypePrefsPath($type), 0640); chmod(getConfigMetadataPath($type), 0660);
    }
    if (!empty($request['mirrorDirectories'])) {
        foreach ([getFolderFilePath($type), getTypePrefsPath($type), getConfigMetadataPath($type)] as $path) {
            unlink($path . '.lastgood'); mkdir($path . '.lastgood');
        }
    }
    $before = \ConfigWriteFault\fixtureState($root, $type);
    $other = \ConfigWriteFault\fixtureState($root, $type === 'vm' ? 'docker' : 'vm');
    $fault = &$GLOBALS['config_write_fault'];
    $fault['enabled'] = true; $fault['rollback'] = !empty($request['rollback']); $fault['mirrors'] = !empty($request['mirrors']);
    $fault['pause'] = !empty($request['pause']);
    $fault['readOnlyAfterPrimary'] = !empty($request['readOnlyAfterPrimary']);
    if (!empty($request['readOnlyBeforePrimary'])) chmod("$root/config", 0555);
    $errorMessage = ''; $previous = ''; $errorClass = '';
    try {
        if ($operation === 'batch') {
            \ConfigWriteFault\applyFolderBatchOperations($type, ['deletes' => ['old'], 'creates' => [], 'upserts' => []]);
        } elseif ($operation === 'bulk') {
            \ConfigWriteFault\bulkAssignItemsToFolders($type, [['folderId' => 'target', 'items' => ['fixture-member']]]);
        } elseif ($operation === 'backup') {
            \ConfigWriteFault\restoreBackupSnapshot($type, $backupName);
        } elseif ($operation === 'environment') {
            $snapshot = exportEnvironmentSnapshotPayload();
            foreach (['docker', 'vm'] as $seedType) $snapshot['types'][$seedType]['folders'] = ['new' => ['name' => 'New fixture']];
            \ConfigWriteFault\applyEnvironmentSnapshotTransaction($snapshot, '', ['syncDockerOrder' => false]);
        } else {
            \ConfigWriteFault\withConfigMutationLock(static function () use ($type, $kind, $request): void {
                if (isset($request['expectedRevision'])) \ConfigWriteFault\assertExpectedConfigRevision($type, $kind, $request['expectedRevision']);
                if ($kind === 'folder') \ConfigWriteFault\writeRawFolderMap($type, [!empty($request['contender']) ? 'winner' : 'new' => ['name' => 'New fixture']]);
                else \ConfigWriteFault\writeTypePrefs($type, ['sortMode' => 'alpha', 'backupSchedule' => ['enabled' => false]]);
            });
        }
    } catch (Throwable $error) {
        $errorMessage = $error->getMessage(); $previous = $error->getPrevious()?->getMessage() ?? ''; $errorClass = get_class($error);
    }
    if (!empty($request['readOnlyAfterPrimary']) || !empty($request['readOnlyBeforePrimary'])) chmod("$root/config", 0755);
    $fault['enabled'] = false; $fault['rollback'] = false; $fault['mirrors'] = false;
    putenv('FVPLUS_STORAGE_FAILURE_INJECTION=0');
    putenv('FVPLUS_STORAGE_FAILURE_STAGE=');
    $after = \ConfigWriteFault\fixtureState($root, $type);
    $runtimeSnapshot = \ConfigWriteFault\getDurableStorageRuntimeSnapshot();
    $metadata = !empty($request['restart']) ? null : \ConfigWriteFault\readConfigMetadata($type, true);
    $beforeMetadata = isset($before['.metadata.json'][0]) ? json_decode(base64_decode($before['.metadata.json'][0]), true) : [];
    $tokenBefore = runtimeSnapshotToken($type, ['metadata' => $beforeMetadata], [], 'fixture');
    $tokenAfter = runtimeSnapshotToken($type, ['metadata' => $metadata], [], 'fixture');
    if (!empty($request['contender'])) file_put_contents("$root/contender-finished", 'finished');
    echo json_encode(['before' => $before, 'after' => $after, 'observed' => $fault['observed'] ?? null,
        'error' => $errorMessage, 'previous' => $previous, 'errorClass' => $errorClass,
        'metadata' => $metadata, 'runtimeSnapshot' => $runtimeSnapshot,
        'tokenBefore' => $tokenBefore, 'tokenAfter' => $tokenAfter,
        'mirrorDirectoriesIntact' => !empty($request['mirrorDirectories']) && is_dir(getFolderFilePath($type) . '.lastgood')
            && is_dir(getTypePrefsPath($type) . '.lastgood') && is_dir(getConfigMetadataPath($type) . '.lastgood'),
        'otherUnchanged' => $other === \ConfigWriteFault\fixtureState($root, $type === 'vm' ? 'docker' : 'vm'),
        'temps' => glob("$root/config/*.tmp.*") ?: [], 'sentinel' => file_get_contents("$root/rename-denied/sentinel")]);
}
