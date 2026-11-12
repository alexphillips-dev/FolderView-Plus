<?php
namespace Followup {
    function gmdate(string $format, ?int $timestamp = null): string {
        if ($format !== 'Ymd-His') return \gmdate($format, $timestamp);
        $probe = fopen(\getConfigMutationLockPath(), 'c+');
        $available = flock($probe, LOCK_EX | LOCK_NB);
        if ($available) flock($probe, LOCK_UN);
        fclose($probe);
        $GLOBALS['allocationLocked'] = !$available;
        return '20261104-000000';
    }
    function resolveCustomIconUploadSource(): array {
        return ['tmpPath' => $GLOBALS['root'] . '/incoming.svg', 'extension' => 'svg',
            'originalName' => 'fixture.svg', 'isHttpUpload' => false, 'cleanupPath' => ''];
    }
    function writeCustomIconMetadataIndex(array $meta): void {
        \writeCustomIconMetadataIndex($meta);
        if (($GLOBALS['uploadFault'] ?? '') === 'metadata') {
            $GLOBALS['uploadFault'] = '';
            throw new \RuntimeException('Injected upload metadata failure');
        }
    }
    function fvplusCopyCustomIconStorageFile(string $from, string $to): bool {
        if (($GLOBALS['uploadFault'] ?? '') === 'mirror') {
            $GLOBALS['uploadFault'] = '';
            return false;
        }
        return \fvplusCopyCustomIconStorageFile($from, $to);
    }
}
namespace {
    $server = $argv[1]; $root = $argv[2]; $mode = $argv[3];
    foreach (['config', 'source/images/custom', 'host'] as $dir) mkdir("$root/$dir", 0700, true);
    putenv("FVPLUS_TEST_CONFIG_DIR=$root/config");
    putenv("FVPLUS_TEST_SOURCE_DIR=$root/source");
    $_SERVER['DOCUMENT_ROOT'] = "$root/host";
    require "$server/lib.php";
    if ($mode === 'backup') {
        $source = str_replace('__DIR__', var_export($server, true), substr(file_get_contents("$server/lib.backup-snapshots.php"), 5));
        eval('namespace Followup; use \\RuntimeException; use \\Throwable; use \\DateTimeImmutable; use \\DateTimeZone;' . $source);
        $names = [];
        for ($index = 0; $index < 12; $index++) {
            writeRawFolderMap('vm', ['fixture-' . $index => ['name' => 'Fixture ' . $index]]);
            $names[] = \Followup\createBackupSnapshot('vm', 'manual')['name'];
        }
        $first = readBackupSnapshot('vm', $names[0]);
        $latest = listBackupSnapshots('vm')[0];
        $pruned = pruneBackupSnapshots('vm', 2);
        $remaining = array_column(listBackupSnapshots('vm'), 'name');
        $prefsFirst = \Followup\createBackupSnapshot('vm', 'before-prefs-update')['name'];
        $prefsSecond = \Followup\createBackupSnapshot('vm', 'before-prefs-update')['name'];
        $recentBeforeDelete = findRecentPrefsBackupSnapshot('vm', 30);
        unlink(getBackupSnapshotPath('vm', $prefsFirst));
        $recentAfterDelete = findRecentPrefsBackupSnapshot('vm', 30);
        $coalesced = createCoalescedPrefsBackupSnapshot('vm', 30);
        echo json_encode(['unique' => count(array_unique($names)), 'firstFolders' => array_keys($first['folders']),
            'latest' => $latest['name'], 'expectedLatest' => $names[11], 'remaining' => $remaining,
            'expectedRemaining' => [$names[11], $names[10]], 'pruned' => count($pruned), 'locked' => $GLOBALS['allocationLocked'],
            'recentBeforeDelete' => $recentBeforeDelete['name'], 'recentAfterDelete' => $recentAfterDelete['name'],
            'expectedRecent' => $prefsSecond, 'coalesced' => $coalesced]);
    } elseif ($mode === 'upload') {
        require "$server/lib.custom-icon-endpoint-foundation.php";
        require "$server/lib.custom-icon-validation.php";
        require "$server/lib.custom-icon-actions.php";
        $runtime = fvplusCustomIconRuntimeDirPath();
        $mirror = ($argv[4] ?? '') === 'mirror';
        if ($mirror) {
            if (is_link($runtime)) unlink($runtime);
            if (!is_dir($runtime)) mkdir($runtime, 0700, true);
            file_put_contents("$runtime/!unmanaged.txt", 'keep');
        }
        $old = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1"/></svg>';
        $new = str_replace('rect', 'path', $old); // Equal size and same-second mtime must still replace the mirror.
        $target = customIconDirPath() . '/fixture.svg';
        file_put_contents($target, $old);
        $meta = syncCustomIconMetadataIndex(customIconDirPath());
        $meta['fixture.svg']['mime'] = 'image/svg+xml';
        writeCustomIconMetadataIndex($meta);
        fvplusEnsureCustomIconStorageReady(false);
        if ($mirror) copy(customIconMetadataPath(), "$runtime/.metadata.json");
        $paths = [$target, customIconMetadataPath(), getLastGoodJsonPath(customIconMetadataPath())];
        if ($mirror) $paths = array_merge($paths, ["$runtime/fixture.svg", "$runtime/.metadata.json"]);
        $before = array_map('fvplusTransactionCaptureFile', $paths);
        file_put_contents("$root/incoming.svg", $new);
        $source = str_replace('__DIR__', var_export($server, true), substr(file_get_contents("$server/lib.custom-icon-actions.php"), 5));
        eval('namespace Followup; use \\RuntimeException; use \\Throwable;' . $source);
        $_POST = ['replace' => '1', 'dedupe' => '0'];
        $GLOBALS['uploadFault'] = $argv[5] ?? '';
        $error = ''; $result = null;
        try { $result = \Followup\handleCustomIconUploadAction(); }
        catch (Throwable $failure) { $error = $failure->getMessage(); }
        clearstatcache();
        $restored = $before === array_map('fvplusTransactionCaptureFile', $paths);
        if ($error !== '') $result = \Followup\handleCustomIconUploadAction();
        echo json_encode(['error' => $error, 'restored' => $restored, 'replaced' => $result['replaced'],
            'persistentNew' => file_get_contents($target) === $new, 'publicNew' => file_get_contents("$runtime/fixture.svg") === $new,
            'metadataHash' => readCustomIconMetadataIndex()['fixture.svg']['hash'], 'expectedHash' => hash('sha256', $new)]);
    } elseif ($mode === 'profiles') {
        $name = str_repeat(hex2bin('e4b8ad'), 27);
        $member = str_repeat(hex2bin('f09f9880'), 41);
        $profiles = fvplusNormalizeWebuiProfiles(array_fill(0, 12, ['name' => $name, 'containers' => [$member]]));
        writeRawFolderMap('vm', ['fixture' => ['name' => 'Fixture', 'settings' => ['webui_profiles' => $profiles]]]);
        $reloaded = readRawFolderMap('vm')['fixture']['settings']['webui_profiles'];
        echo json_encode(['profiles' => $profiles, 'reloaded' => $reloaded, 'stable' => $profiles === fvplusNormalizeWebuiProfiles($profiles)], JSON_THROW_ON_ERROR);
    }
}
