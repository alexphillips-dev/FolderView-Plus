<?php
function readJsonObjectFile(string $path): ?array {
        if (!file_exists($path)) {
            return null;
        }
        $decoded = @json_decode((string)@file_get_contents($path), true);
        return is_array($decoded) ? $decoded : null;
    }

    function getConfigMutationLockPath(): string {
        global $configDir;
        if (!is_dir($configDir)) {
            @mkdir($configDir, 0770, true);
        }
        return "$configDir/.config-mutation.lock";
    }

    function acquireConfigMutationLock(): void {
        if (is_resource($GLOBALS['fvplus_config_mutation_lock_handle'] ?? null)) {
            return;
        }
        $handle = @fopen(getConfigMutationLockPath(), 'c+');
        if (!is_resource($handle)) {
            throw new RuntimeException('Unable to open the configuration mutation lock.');
        }
        $startedAt = microtime(true);
        $locked = false;
        while ((microtime(true) - $startedAt) <= FVPLUS_CONFIG_MUTATION_LOCK_TIMEOUT_SECONDS) {
            if (@flock($handle, LOCK_EX | LOCK_NB)) {
                $locked = true;
                break;
            }
            usleep(25000);
        }
        if (!$locked) {
            @fclose($handle);
            throw new RuntimeException('FolderView Plus configuration is busy. Please retry the action.');
        }
        $GLOBALS['fvplus_config_mutation_lock_handle'] = $handle;
        register_shutdown_function(static function (): void {
            $active = $GLOBALS['fvplus_config_mutation_lock_handle'] ?? null;
            if (!is_resource($active)) {
                return;
            }
            @flock($active, LOCK_UN);
            @fclose($active);
            $GLOBALS['fvplus_config_mutation_lock_handle'] = null;
        });
    }

    function releaseConfigMutationLock(): void {
        $handle = $GLOBALS['fvplus_config_mutation_lock_handle'] ?? null;
        if (!is_resource($handle)) {
            return;
        }
        @flock($handle, LOCK_UN);
        @fclose($handle);
        $GLOBALS['fvplus_config_mutation_lock_handle'] = null;
    }

    function withConfigMutationLock(callable $callback) {
        $alreadyHeld = is_resource($GLOBALS['fvplus_config_mutation_lock_handle'] ?? null);
        if (!$alreadyHeld) {
            acquireConfigMutationLock();
        }
        try {
            return $callback();
        } finally {
            if (!$alreadyHeld) {
                releaseConfigMutationLock();
            }
        }
    }

    function getLastGoodJsonPath(string $path): string {
        return $path . '.lastgood';
    }

    function createAtomicWriteTempPath(string $path): string {
        $parent = dirname($path);
        $prefix = basename($path) . '.tmp.';
        $tempPath = @tempnam($parent, $prefix);
        if (is_string($tempPath) && $tempPath !== '') {
            return $tempPath;
        }

        try {
            return $path . '.tmp.' . getmypid() . '.' . bin2hex(random_bytes(6));
        } catch (Throwable $error) {
            return $path . '.tmp.' . getmypid() . '.' . uniqid('', true);
        }
    }

    function fvplusStorageFailureStage(): string {
        $enabled = trim((string)getenv('FVPLUS_STORAGE_FAILURE_INJECTION')) === '1';
        if (!$enabled) {
            return '';
        }
        return strtolower(trim((string)getenv('FVPLUS_STORAGE_FAILURE_STAGE')));
    }

    function fvplusStorageFailureInjected(string $stage): bool {
        return fvplusStorageFailureStage() === strtolower(trim($stage));
    }

    function fvplusStorageThrowInjectedFailure(string $stage, string $path): void {
        if (fvplusStorageFailureInjected($stage)) {
            throw new RuntimeException("Injected durable storage failure at '$stage' for '" . basename($path) . "'.");
        }
    }

    function fvplusFlushFileHandleBestEffort($handle): bool {
        if (!is_resource($handle)) {
            return false;
        }
        if (!@fflush($handle)) {
            return false;
        }
        if (!function_exists('fsync')) {
            return true;
        }
        return @fsync($handle);
    }

    function fvplusFlushDirectoryBestEffort(string $directory): bool {
        if (!function_exists('fsync') || !is_dir($directory)) {
            return false;
        }
        $handle = @fopen($directory, 'r');
        if (!is_resource($handle)) {
            return false;
        }
        try {
            return @fsync($handle);
        } finally {
            @fclose($handle);
        }
    }

    function getDurableStorageRuntimeSnapshot(): array {
        $snapshot = $GLOBALS['fvplus_durable_storage_snapshot'] ?? [];
        return is_array($snapshot) ? $snapshot : [];
    }

    function writeDurableFileAtomic(string $path, string $contents, array $options = []): array {
        $transactionId = getRequestTransactionId();
        $traceId = getRequestTraceId();
        $tmpPath = '';
        $handle = null;
        $fileFlushed = false;
        $directoryFlushed = false;
        try {
            fvplusAssertDurableWriteTarget($path);
            $parent = dirname($path);
            fvplusStorageThrowInjectedFailure('parent-create', $path);
            if (!is_dir($parent) && !@mkdir($parent, 0770, true) && !is_dir($parent)) {
                throw new RuntimeException("Failed to create durable storage directory for '$path'.");
            }
            fvplusStorageThrowInjectedFailure('read-only', $path);
            if (!is_writable($parent)) {
                throw new RuntimeException("Durable storage directory is read-only for '$path'.");
            }

            $existingMode = is_file($path) ? ((int)@fileperms($path) & 0777) : 0;
            $requestedMode = max(0, (int)($options['mode'] ?? 0644));
            $mode = $existingMode > 0 ? $existingMode : ($requestedMode > 0 ? $requestedMode : 0644);
            fvplusStorageThrowInjectedFailure('temp-create', $path);
            $tmpPath = createAtomicWriteTempPath($path);
            if (is_link($tmpPath)) {
                throw new RuntimeException("Durable storage temp path is unsafe for '$path'.");
            }
            @chmod($tmpPath, 0600);
            $handle = @fopen($tmpPath, 'c+b');
            if (!is_resource($handle)) {
                throw new RuntimeException("Failed to open temp durable payload for '$path'.");
            }
            if (!@flock($handle, LOCK_EX) || !@ftruncate($handle, 0) || @rewind($handle) === false) {
                throw new RuntimeException("Failed to prepare temp durable payload for '$path'.");
            }
            fvplusStorageThrowInjectedFailure('temp-write', $path);

            $length = strlen($contents);
            $written = 0;
            if (fvplusStorageFailureInjected('interrupted-write')) {
                $partialLength = max(1, (int)floor(max(1, $length) / 2));
                @fwrite($handle, substr($contents, 0, $partialLength));
                throw new RuntimeException("Injected interrupted durable write for '" . basename($path) . "'.");
            }
            while ($written < $length) {
                $chunk = @fwrite($handle, substr($contents, $written));
                if ($chunk === false || $chunk <= 0) {
                    throw new RuntimeException("Failed to complete temp durable payload for '$path' (storage may be full).");
                }
                $written += $chunk;
                if (fvplusStorageFailureInjected('disk-full') && $written < $length) {
                    throw new RuntimeException("Injected full-disk durable write failure for '" . basename($path) . "'.");
                }
            }
            if (fvplusStorageFailureInjected('disk-full')) {
                throw new RuntimeException("Injected full-disk durable write failure for '" . basename($path) . "'.");
            }
            fvplusStorageThrowInjectedFailure('file-flush', $path);
            $fileFlushed = fvplusFlushFileHandleBestEffort($handle);
            if (!$fileFlushed) {
                throw new RuntimeException("Failed to flush temp durable payload for '$path'.");
            }
            @flock($handle, LOCK_UN);
            @fclose($handle);
            $handle = null;

            fvplusStorageThrowInjectedFailure('rename', $path);
            if (!@rename($tmpPath, $path)) {
                throw new RuntimeException("Failed to atomically replace durable payload for '$path'.");
            }
            $tmpPath = '';
            @chmod($path, $mode);
            if (!fvplusStorageFailureInjected('directory-flush')) {
                $directoryFlushed = fvplusFlushDirectoryBestEffort($parent);
            }

            $result = [
                'ok' => true,
                'target' => basename($path),
                'bytes' => $length,
                'traceId' => $traceId,
                'transactionId' => $transactionId,
                'fileFlushed' => $fileFlushed,
                'directoryFlushed' => $directoryFlushed,
                'committedAt' => gmdate('c')
            ];
            $GLOBALS['fvplus_durable_storage_snapshot'] = $result;
            return $result;
        } catch (Throwable $error) {
            if (is_resource($handle)) {
                @flock($handle, LOCK_UN);
                @fclose($handle);
            }
            if ($tmpPath !== '' && file_exists($tmpPath)) {
                @unlink($tmpPath);
            }
            $GLOBALS['fvplus_durable_storage_snapshot'] = [
                'ok' => false,
                'target' => basename($path),
                'traceId' => $traceId,
                'transactionId' => $transactionId,
                'failedStage' => fvplusStorageFailureStage(),
                'failedAt' => gmdate('c')
            ];
            throw $error;
        }
    }

    function writeJsonObjectAtomic(string $path, array $payload): void {
        $encoded = json_encode($payload, JSON_UNESCAPED_SLASHES);
        if (!is_string($encoded) || $encoded === '') {
            throw new RuntimeException("Failed to encode JSON payload for '$path'.");
        }
        writeDurableFileAtomic($path, $encoded);
    }

    function writeJsonObjectWithLastGood(string $path, array $payload): void {
        writeJsonObjectAtomic($path, $payload);
        $lastGoodPath = getLastGoodJsonPath($path);
        try {
            fvplusStorageThrowInjectedFailure('last-good', $lastGoodPath);
            writeJsonObjectAtomic($lastGoodPath, $payload);
        } catch (Throwable $error) {
            // Keep primary writes non-fatal if last-good mirror fails.
        }
    }

    function recoverJsonObjectFromLastGood(string $path): ?array {
        $lastGoodPath = getLastGoodJsonPath($path);
        $decoded = readJsonObjectFile($lastGoodPath);
        if (!is_array($decoded)) {
            return null;
        }
        try {
            writeJsonObjectAtomic($path, $decoded);
        } catch (Throwable $error) {
            // Keep recovery best-effort.
        }
        return $decoded;
    }

    function getConfigMetadataPath(string $type): string {
        global $configDir;
        $safeType = ensureType($type);
        return "$configDir/$safeType.metadata.json";
    }

    function configMetadataTimestampFromPath(string $path): string {
        $mtime = is_file($path) ? (int)@filemtime($path) : 0;
        return $mtime > 0 ? gmdate('c', $mtime) : '';
    }

    function configMetadataHashFromPath(string $path): string {
        if (!is_file($path)) {
            return '';
        }
        $hash = @hash_file('sha256', $path);
        return is_string($hash) ? strtolower(trim($hash)) : '';
    }

    function defaultConfigMetadata(string $type): array {
        $safeType = ensureType($type);
        $folderPath = getFolderFilePath($safeType);
        $prefsPath = getTypePrefsPath($safeType);
        $now = gmdate('c');
        return [
            'schemaVersion' => FVPLUS_CONFIG_METADATA_SCHEMA_VERSION,
            'type' => $safeType,
            'createdAt' => $now,
            'updatedAt' => $now,
            'folderRevision' => is_file($folderPath) ? 1 : 0,
            'prefsRevision' => is_file($prefsPath) ? 1 : 0,
            'folderUpdatedAt' => configMetadataTimestampFromPath($folderPath),
            'prefsUpdatedAt' => configMetadataTimestampFromPath($prefsPath),
            'folderSha256' => configMetadataHashFromPath($folderPath),
            'prefsSha256' => configMetadataHashFromPath($prefsPath),
            'externalChangeCount' => 0,
            'lastExternalChangeAt' => '',
            'lastTraceId' => '',
            'lastTransactionId' => '',
            'lastMutationAt' => ''
        ];
    }

    function normalizeConfigMetadata($value, string $type): array {
        $safeType = ensureType($type);
        $incoming = is_array($value) ? $value : [];
        $defaults = defaultConfigMetadata($safeType);
        $createdAt = normalizeIsoTimestamp($incoming['createdAt'] ?? '');
        if ($createdAt === '') {
            $createdAt = (string)$defaults['createdAt'];
        }
        $updatedAt = normalizeIsoTimestamp($incoming['updatedAt'] ?? '');
        if ($updatedAt === '') {
            $updatedAt = (string)$defaults['updatedAt'];
        }
        return [
            'schemaVersion' => FVPLUS_CONFIG_METADATA_SCHEMA_VERSION,
            'type' => $safeType,
            'createdAt' => $createdAt,
            'updatedAt' => $updatedAt,
            'folderRevision' => max(0, (int)($incoming['folderRevision'] ?? $defaults['folderRevision'])),
            'prefsRevision' => max(0, (int)($incoming['prefsRevision'] ?? $defaults['prefsRevision'])),
            'folderUpdatedAt' => normalizeIsoTimestamp($incoming['folderUpdatedAt'] ?? ''),
            'prefsUpdatedAt' => normalizeIsoTimestamp($incoming['prefsUpdatedAt'] ?? ''),
            'folderSha256' => strtolower(trim((string)($incoming['folderSha256'] ?? ''))),
            'prefsSha256' => strtolower(trim((string)($incoming['prefsSha256'] ?? ''))),
            'externalChangeCount' => max(0, (int)($incoming['externalChangeCount'] ?? 0)),
            'lastExternalChangeAt' => normalizeIsoTimestamp($incoming['lastExternalChangeAt'] ?? ''),
            'lastTraceId' => normalizeRequestTraceId((string)($incoming['lastTraceId'] ?? '')),
            'lastTransactionId' => normalizeRequestTransactionId((string)($incoming['lastTransactionId'] ?? '')),
            'lastMutationAt' => normalizeIsoTimestamp($incoming['lastMutationAt'] ?? '')
        ];
    }

    function writeConfigMetadata(string $type, array $metadata): array {
        $safeType = ensureType($type);
        $normalized = normalizeConfigMetadata($metadata, $safeType);
        writeJsonObjectWithLastGood(getConfigMetadataPath($safeType), $normalized);
        return $normalized;
    }

    function readConfigMetadata(string $type, bool $reconcile = true): array {
        $safeType = ensureType($type);
        return withConfigMutationLock(static function () use ($safeType, $reconcile): array {
            $path = getConfigMetadataPath($safeType);
            $decoded = readJsonObjectFile($path);
            $recovered = false;
            if (!is_array($decoded)) {
                $decoded = recoverJsonObjectFromLastGood($path);
                $recovered = is_array($decoded);
            }
            $metadata = normalizeConfigMetadata($decoded, $safeType);
            $changed = $recovered || !is_array($decoded) || jsonObjectsDiffer($decoded, $metadata);

            if ($reconcile) {
                $now = gmdate('c');
                $targets = [
                    'folder' => getFolderFilePath($safeType),
                    'prefs' => getTypePrefsPath($safeType)
                ];
                foreach ($targets as $kind => $targetPath) {
                    $hashKey = $kind . 'Sha256';
                    $revisionKey = $kind . 'Revision';
                    $updatedKey = $kind . 'UpdatedAt';
                    $actualHash = configMetadataHashFromPath($targetPath);
                    $storedHash = strtolower(trim((string)($metadata[$hashKey] ?? '')));
                    if (is_array($decoded) && $storedHash !== $actualHash) {
                        $metadata[$revisionKey] = max(0, (int)$metadata[$revisionKey]) + 1;
                        $metadata['externalChangeCount'] = max(0, (int)$metadata['externalChangeCount']) + 1;
                        $metadata['lastExternalChangeAt'] = $now;
                        $changed = true;
                    }
                    if ($storedHash !== $actualHash) {
                        $metadata[$hashKey] = $actualHash;
                        $metadata[$updatedKey] = configMetadataTimestampFromPath($targetPath);
                        $changed = true;
                    }
                }
                if ($changed) {
                    $metadata['updatedAt'] = $now;
                }
            }

            if ($changed) {
                return writeConfigMetadata($safeType, $metadata);
            }
            return $metadata;
        });
    }

    function commitConfigMetadataWrite(string $type, string $kind, string $targetPath, array $metadata): array {
        $safeType = ensureType($type);
        if (!in_array($kind, ['folder', 'prefs'], true)) {
            throw new RuntimeException('Unsupported configuration metadata kind.');
        }
        $now = gmdate('c');
        $revisionKey = $kind . 'Revision';
        $updatedKey = $kind . 'UpdatedAt';
        $hashKey = $kind . 'Sha256';
        $metadata = normalizeConfigMetadata($metadata, $safeType);
        $metadata[$revisionKey] = max(0, (int)$metadata[$revisionKey]) + 1;
        $metadata[$updatedKey] = $now;
        $metadata[$hashKey] = configMetadataHashFromPath($targetPath);
        $metadata['updatedAt'] = $now;
        $metadata['lastTraceId'] = getRequestTraceId();
        $metadata['lastTransactionId'] = getRequestTransactionId();
        $metadata['lastMutationAt'] = $now;
        return writeConfigMetadata($safeType, $metadata);
    }

    function rebuildConfigMetadata(string $type): array {
        $safeType = ensureType($type);
        return withConfigMutationLock(static function () use ($safeType): array {
            $path = getConfigMetadataPath($safeType);
            $decoded = readJsonObjectFile($path);
            if (!is_array($decoded)) {
                $decoded = readJsonObjectFile(getLastGoodJsonPath($path));
            }
            $previous = normalizeConfigMetadata($decoded, $safeType);
            $rebuilt = defaultConfigMetadata($safeType);
            $rebuilt['createdAt'] = (string)($previous['createdAt'] ?? $rebuilt['createdAt']);
            $rebuilt['folderRevision'] = max(1, (int)($previous['folderRevision'] ?? 0) + 1);
            $rebuilt['prefsRevision'] = max(1, (int)($previous['prefsRevision'] ?? 0) + 1);
            $rebuilt['externalChangeCount'] = max(0, (int)($previous['externalChangeCount'] ?? 0)) + 1;
            $rebuilt['lastExternalChangeAt'] = gmdate('c');
            $rebuilt['updatedAt'] = gmdate('c');
            return writeConfigMetadata($safeType, $rebuilt);
        });
    }

    function assertExpectedConfigRevision(string $type, string $kind, $expectedRevision): array {
        $safeType = ensureType($type);
        $metadata = readConfigMetadata($safeType, true);
        $raw = trim((string)$expectedRevision);
        if ($raw === '') {
            return $metadata;
        }
        if (!ctype_digit($raw)) {
            throw new RuntimeException('Invalid expected configuration revision.');
        }
        $key = $kind === 'prefs' ? 'prefsRevision' : 'folderRevision';
        $expected = (int)$raw;
        $current = max(0, (int)($metadata[$key] ?? 0));
        if ($expected !== $current) {
            throw new FVPlusConfigConflictException(sprintf(
                'This %s configuration changed in another page or browser tab (expected revision %d, current revision %d). Refresh before saving again.',
                $kind === 'prefs' ? 'preferences' : 'folder',
                $expected,
                $current
            ));
        }
        return $metadata;
    }
