<?php
function fvplusCustomIconStorageLockPath(): string {
    $tmpRoot = function_exists('sys_get_temp_dir') ? trim((string)sys_get_temp_dir()) : '/tmp';
    if ($tmpRoot === '') {
        $tmpRoot = '/tmp';
    }
    $normalized = rtrim(str_replace('\\', '/', $tmpRoot), '/');
    if ($normalized === '') {
        $normalized = '/tmp';
    }
    return $normalized . '/folderview.plus-custom-icons.lock';
}

function fvplusWithCustomIconStorageLock(bool $exclusive, callable $callback) {
    // Request guards already own the config lock; every icon caller follows the same order.
    return withConfigMutationLock(static function () use ($exclusive, $callback) {
        $lockPath = fvplusCustomIconStorageLockPath();
        $handle = @fopen($lockPath, 'c+');
        if (!is_resource($handle)) {
            throw new RuntimeException('Unable to open custom icon lock file. Run: ' . fvplusCustomIconRepairHintCommand());
        }
        $mode = LOCK_EX; // Bootstrap may migrate or mirror files before a read callback.
        $start = microtime(true);
        $locked = false;
        $timeout = defined('FVPLUS_CUSTOM_ICON_LOCK_TIMEOUT_SECONDS') ? FVPLUS_CUSTOM_ICON_LOCK_TIMEOUT_SECONDS : 10;
        while ((microtime(true) - $start) <= $timeout) {
            if (@flock($handle, $mode | LOCK_NB)) {
                $locked = true;
                break;
            }
            usleep(25000);
        }
        if (!$locked) {
            @fclose($handle);
            throw new RuntimeException('Custom icon store is busy. Please try again.');
        }
        try {
            $health = fvplusEnsureCustomIconStorageReady(false);
            $directory = (string)($health['storageDir'] ?? fvplusCustomIconDirPath());
            if ($exclusive && !is_writable($directory)) {
                @chmod($directory, 0770);
            }
            if ($exclusive && !is_writable($directory)) {
                throw new RuntimeException('Custom icon directory is not writable. Run: ' . fvplusCustomIconRepairHintCommand());
            }
            if (!$exclusive && !@flock($handle, LOCK_SH)) throw new RuntimeException('Custom icon store is busy. Please try again.');
            return $callback();
        } finally {
            @flock($handle, LOCK_UN);
            @fclose($handle);
        }
    });
}

require_once __DIR__ . '/lib.custom-icon-references.php';
require_once __DIR__ . '/lib.custom-icon-repair.php';


    function fvplusCustomIconDirPath(): string {
        global $configDir;
        return "$configDir/images/custom";
    }

    function fvplusCustomIconRuntimeDirPath(): string {
        global $sourceDir;
        return "$sourceDir/images/custom";
    }

    function fvplusCustomIconRepairHintCommand(): string {
        $dir = fvplusCustomIconDirPath();
        return "mkdir -p " . escapeshellarg($dir) . " && chmod -R 775 " . escapeshellarg($dir);
    }

    function fvplusShouldManageCustomIconStorageEntry(string $name, bool $includeMetadata = true): bool {
        $safeName = trim($name);
        if ($safeName === '' || $safeName !== basename($safeName) || $safeName === '.' || $safeName === '..') {
            return false;
        }
        if ($includeMetadata && $safeName === '.metadata.json') {
            return true;
        }
        if ($safeName === 'README.txt') {
            return $includeMetadata;
        }
        $extension = strtolower((string)pathinfo($safeName, PATHINFO_EXTENSION));
        return $extension !== '' && in_array($extension, fvplusAllowedCustomIconExtensions(), true);
    }

    function fvplusCopyCustomIconStorageFile(string $sourcePath, string $targetPath): bool {
        $contents = @file_get_contents($sourcePath);
        if (!is_string($contents)) {
            return false;
        }
        try {
            writeDurableFileAtomic($targetPath, $contents, ['mode' => 0644]);
        } catch (Throwable $error) {
            return false;
        }
        $mtime = (int)@filemtime($sourcePath);
        if ($mtime > 0) {
            @touch($targetPath, $mtime);
        }
        @chmod($targetPath, 0644);
        return true;
    }

    function fvplusListCustomIconStorageEntries(string $directory, bool $includeMetadata = true): array {
        $entries = [];
        if (!is_dir($directory)) {
            return $entries;
        }
        foreach ((array)@scandir($directory) as $name) {
            if (!fvplusShouldManageCustomIconStorageEntry((string)$name, $includeMetadata)) {
                continue;
            }
            $path = "$directory/$name";
            if (!is_file($path)) {
                continue;
            }
            $entries[(string)$name] = [
                'path' => $path,
                'mtime' => max(0, (int)@filemtime($path)),
                'size' => max(0, (int)@filesize($path))
            ];
        }
        return $entries;
    }

    function fvplusMigrateRuntimeCustomIconsToPersistent(): array {
        $runtimeDir = fvplusCustomIconRuntimeDirPath();
        $storageDir = fvplusCustomIconDirPath();
        $migratedFiles = [];
        $migratedMetadata = false;
        if (!is_dir($runtimeDir) || is_link($runtimeDir)) {
            return [
                'migratedFileCount' => 0,
                'migratedMetadata' => false,
                'migratedFiles' => []
            ];
        }
        if (!is_dir($storageDir)) {
            @mkdir($storageDir, 0770, true);
        }
        $runtimeEntries = fvplusListCustomIconStorageEntries($runtimeDir, true);
        foreach ($runtimeEntries as $name => $entry) {
            if ($name === 'README.txt') {
                continue;
            }
            $sourcePath = (string)($entry['path'] ?? '');
            if ($sourcePath === '') {
                continue;
            }
            $targetPath = "$storageDir/$name";
            $shouldCopy = !is_file($targetPath);
            if (!$shouldCopy) {
                $targetSize = max(0, (int)@filesize($targetPath));
                $targetMtime = max(0, (int)@filemtime($targetPath));
                $shouldCopy = $targetSize !== (int)($entry['size'] ?? 0) || $targetMtime < (int)($entry['mtime'] ?? 0);
            }
            if (!$shouldCopy) {
                continue;
            }
            if (!fvplusCopyCustomIconStorageFile($sourcePath, $targetPath)) {
                continue;
            }
            if ($name === '.metadata.json') {
                $migratedMetadata = true;
            } else {
                $migratedFiles[] = $name;
            }
        }
        return [
            'migratedFileCount' => count($migratedFiles),
            'migratedMetadata' => $migratedMetadata,
            'migratedFiles' => array_values($migratedFiles)
        ];
    }

    function fvplusRemoveRuntimeCustomIconDirForLink(): bool {
        $runtimeDir = fvplusCustomIconRuntimeDirPath();
        if (is_link($runtimeDir)) {
            return @unlink($runtimeDir);
        }
        if (!is_dir($runtimeDir)) {
            return !file_exists($runtimeDir);
        }
        foreach ((array)@scandir($runtimeDir) as $name) {
            if ($name === '.' || $name === '..') {
                continue;
            }
            if (!fvplusShouldManageCustomIconStorageEntry((string)$name, true)) {
                return false;
            }
            $path = "$runtimeDir/$name";
            if (!is_file($path) || !@unlink($path)) {
                return false;
            }
        }
        return @rmdir($runtimeDir);
    }

    function fvplusMirrorPersistentCustomIconsToRuntime(): array {
        $storageDir = fvplusCustomIconDirPath();
        $runtimeDir = fvplusCustomIconRuntimeDirPath();
        $copied = 0;
        $pruned = 0;
        $runtimeParent = dirname($runtimeDir);
        if (!is_dir($runtimeParent)) {
            @mkdir($runtimeParent, 0770, true);
        }
        if (!is_dir($runtimeDir)) {
            @mkdir($runtimeDir, 0770, true);
        }
        if (!is_dir($runtimeDir)) {
            return [
                'copiedCount' => 0,
                'prunedCount' => 0,
                'ready' => false
            ];
        }

        $storageEntries = fvplusListCustomIconStorageEntries($storageDir, false);
        $runtimeEntries = fvplusListCustomIconStorageEntries($runtimeDir, false);

        foreach ($storageEntries as $name => $entry) {
            $sourcePath = (string)($entry['path'] ?? '');
            $targetPath = "$runtimeDir/$name";
            $targetExists = is_file($targetPath);
            $targetSize = $targetExists ? max(0, (int)@filesize($targetPath)) : -1;
            $targetMtime = $targetExists ? max(0, (int)@filemtime($targetPath)) : -1;
            if ($targetExists && $targetSize === (int)($entry['size'] ?? 0) && $targetMtime >= (int)($entry['mtime'] ?? 0)) {
                continue;
            }
            if (fvplusCopyCustomIconStorageFile($sourcePath, $targetPath)) {
                $copied++;
            }
        }

        foreach ($runtimeEntries as $name => $_entry) {
            if (isset($storageEntries[$name])) {
                continue;
            }
            if (@unlink("$runtimeDir/$name")) {
                $pruned++;
            }
        }

        return [
            'copiedCount' => $copied,
            'prunedCount' => $pruned,
            'ready' => is_dir($runtimeDir) && is_readable($runtimeDir)
        ];
    }

    function fvplusEnsureCustomIconStorageReady(bool $requireWritable = false): array {
        $storageDir = fvplusCustomIconDirPath();
        $runtimeDir = fvplusCustomIconRuntimeDirPath();
        $storageParent = dirname($storageDir);
        $runtimeParent = dirname($runtimeDir);
        $repairAttempted = false;

        if (!is_dir($storageParent)) {
            $repairAttempted = true;
            @mkdir($storageParent, 0770, true);
        }
        if (!is_dir($storageDir)) {
            $repairAttempted = true;
            @mkdir($storageDir, 0770, true);
        }
        if (is_dir($storageDir) && !is_writable($storageDir)) {
            $repairAttempted = true;
            @chmod($storageDir, 0770);
        }

        $storageExists = is_dir($storageDir);
        $storageWritable = $storageExists && is_writable($storageDir);
        if (!$storageExists) {
            throw new RuntimeException('Custom icon directory does not exist. Run: ' . fvplusCustomIconRepairHintCommand());
        }
        if ($requireWritable && !$storageWritable) {
            throw new RuntimeException('Custom icon directory is not writable. Run: ' . fvplusCustomIconRepairHintCommand());
        }

        $migration = fvplusMigrateRuntimeCustomIconsToPersistent();
        $repairAttempted = $repairAttempted
            || ((int)($migration['migratedFileCount'] ?? 0) > 0)
            || (($migration['migratedMetadata'] ?? false) === true);

        $publicMode = 'missing';
        $publicReady = false;
        if (is_link($runtimeDir)) {
            $runtimeResolved = @realpath($runtimeDir);
            $storageResolved = @realpath($storageDir);
            if (is_string($runtimeResolved) && $runtimeResolved !== '' && $runtimeResolved === $storageResolved) {
                $publicMode = 'symlink';
                $publicReady = true;
            } else {
                $repairAttempted = true;
                @unlink($runtimeDir);
            }
        }

        $symlinkCreated = false;
        if (!$publicReady && function_exists('symlink')) {
            if (!is_dir($runtimeParent)) {
                $repairAttempted = true;
                @mkdir($runtimeParent, 0770, true);
            }
            if (!file_exists($runtimeDir) || fvplusRemoveRuntimeCustomIconDirForLink()) {
                $repairAttempted = true;
                $symlinkCreated = @symlink($storageDir, $runtimeDir);
            }
            if ($symlinkCreated) {
                $publicMode = 'symlink';
                $publicReady = true;
            }
        }

        $mirror = ['copiedCount' => 0, 'prunedCount' => 0, 'ready' => false];
        if (!$publicReady) {
            $repairAttempted = true;
            $mirror = fvplusMirrorPersistentCustomIconsToRuntime();
            $publicMode = 'mirror';
            $publicReady = ($mirror['ready'] ?? false) === true;
        }

        return [
            'storageDir' => $storageDir,
            'runtimeDir' => $runtimeDir,
            'storageExists' => $storageExists,
            'storageWritable' => $storageWritable,
            'publicMode' => $publicMode,
            'publicReady' => $publicReady,
            'repairAttempted' => $repairAttempted,
            'repairSucceeded' => $storageExists && (!$requireWritable || $storageWritable) && $publicReady,
            'repairHint' => fvplusCustomIconRepairHintCommand(),
            'migratedFileCount' => (int)($migration['migratedFileCount'] ?? 0),
            'migratedMetadata' => ($migration['migratedMetadata'] ?? false) === true,
            'mirrorCopiedCount' => (int)($mirror['copiedCount'] ?? 0),
            'mirrorPrunedCount' => (int)($mirror['prunedCount'] ?? 0)
        ];
    }

    function fvplusBootstrapCustomIconStorage(): void {
        static $bootstrapped = false;
        if ($bootstrapped) {
            return;
        }
        $bootstrapped = true;
        try {
            fvplusWithCustomIconStorageLock(true, static fn(): array => fvplusEnsureCustomIconStorageReady(false));
        } catch (Throwable $_error) {
            // Keep runtime bootstrap non-fatal; diagnostics will surface path issues.
        }
    }



    function fvplusRepairOrphanedMemberReferences(string $type): array {
        $type = ensureType($type);
        return withConfigMutationLock(static function () use ($type): array {
            $repairedFolders = [];
            $repairedMembers = [];
            $typeCounts = ['docker' => 0, 'vm' => 0];
            $infoByName = fvplusReadRepairInventory($type);
            $folders = readRawFolderMap($type);
            fvplusAssertRepairMembersNotRenamed($type, $folders, $infoByName);
            $validNames = array_fill_keys(array_keys(is_array($infoByName) ? $infoByName : []), true);
            $updated = false;
            $typeFolderCount = 0;

            foreach ($folders as $folderId => &$folder) {
                if (!is_array($folder)) {
                    continue;
                }
                $normalizedFolder = normalizeFolderContentPayload($folder);
                $members = normalizeFolderMembers($normalizedFolder['containers'] ?? []);
                if (count($members) <= 0) {
                    $folder = $normalizedFolder;
                    continue;
                }

                $orphanedMembers = array_values(array_filter($members, static function ($memberName) use ($validNames): bool {
                    return !isset($validNames[(string)$memberName]);
                }));
                if (count($orphanedMembers) <= 0) {
                    $folder = $normalizedFolder;
                    continue;
                }

                $normalizedFolder['containers'] = array_values(array_filter($members, static function ($memberName) use ($validNames): bool {
                    return isset($validNames[(string)$memberName]);
                }));
                $folder = $normalizedFolder;

                $repairedFolders[] = [
                    'type' => $type,
                    'folderId' => (string)$folderId,
                    'folderName' => trim((string)($normalizedFolder['name'] ?? (string)$folderId)),
                    'removedCount' => count($orphanedMembers),
                    'removedMembers' => $orphanedMembers
                ];
                foreach ($orphanedMembers as $memberName) {
                    $repairedMembers[(string)$memberName] = true;
                }
                $typeCounts[$type] = (int)($typeCounts[$type] ?? 0) + count($orphanedMembers);
                $typeFolderCount++;
                $updated = true;
            }
            unset($folder);

            if ($updated) {
                createBackupSnapshot($type, 'before-repair-orphaned-members');
                writeRawFolderMap($type, $folders);
                if ($type === 'docker') {
                    syncContainerOrder('docker');
                }
                appendDiagnosticsHistoryEvent(
                    'repair_orphaned_members',
                    $type,
                    [
                        'repairedFolderCount' => $typeFolderCount,
                        'repairedMemberCount' => (int)($typeCounts[$type] ?? 0)
                    ],
                    'ok',
                    'server'
                );
            }
            return [
                'type' => $type,
                'repairedFolderCount' => count($repairedFolders),
                'repairedMemberCount' => count($repairedMembers),
                'repairedMembers' => array_values(array_keys($repairedMembers)),
                'repairedFolders' => $repairedFolders,
                'typeCounts' => $typeCounts
            ];
        });
    }

    function repairPluginPaths(): array {
        global $configDir;
        $created = [];
        if (!is_dir($configDir)) {
            @mkdir($configDir, 0770, true);
            $created[] = $configDir;
        }
        foreach (['styles', 'scripts', 'backups', 'rollback'] as $name) {
            $path = "$configDir/$name";
            if (!is_dir($path)) {
                @mkdir($path, 0770, true);
                $created[] = $path;
            }
        }
        $customIconHealth = fvplusWithCustomIconStorageLock(true, static fn(): array => fvplusEnsureCustomIconStorageReady(false));
        $customIconDir = (string)($customIconHealth['storageDir'] ?? fvplusCustomIconDirPath());
        $customIconRuntimeDir = (string)($customIconHealth['runtimeDir'] ?? fvplusCustomIconRuntimeDirPath());
        foreach ([$customIconDir, dirname($customIconDir)] as $path) {
            if (is_string($path) && $path !== '' && !in_array($path, $created, true) && file_exists($path)) {
                $created[] = $path;
            }
        }
        foreach (FVPLUS_ALLOWED_TYPES as $type) {
            createFile($type);
            readTypePrefs($type); // Normalize and ensure defaults.
        }
        ensureThemeWorkspaceManagedAssets();
        return [
            'createdPaths' => $created,
            'configDir' => $configDir,
            'customIconDir' => $customIconDir,
            'customIconRuntimeDir' => $customIconRuntimeDir
        ];
    }

    fvplusBootstrapCustomIconStorage();
    ensureThemeWorkspaceManagedAssets();
