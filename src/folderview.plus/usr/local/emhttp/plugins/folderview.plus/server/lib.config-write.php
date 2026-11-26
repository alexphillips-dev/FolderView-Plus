<?php
class FVPlusConfigWriteRollbackException extends FVPlusStorageException {}
function commitConfigMetadataWrite(string $type, string $kind, string $targetPath, array $metadata, string $prefsMutationReceipt = '', bool $authoritative = true, int $prefsStartupConflictCount = 0, bool $recoveryWrite = false): array {
    if (!in_array($kind, ['folder', 'prefs'], true)) throw new RuntimeException('Unsupported configuration metadata kind.');
    $now = gmdate('c');
    $revisionKey = $kind . 'Revision';
    $updatedKey = $kind . 'UpdatedAt';
    $hashKey = $kind . 'Sha256';
    $metadata[$revisionKey] = max(0, (int)$metadata[$revisionKey]) + 1;
    if ($kind === 'prefs' && $recoveryWrite) $metadata['prefsRecoveryRevision'] = $metadata[$revisionKey];
    $metadata[$updatedKey] = $now;
    $metadata[$hashKey] = configMetadataHashFromPath($targetPath);
    $metadata['updatedAt'] = $now;
    $metadata['lastTraceId'] = getRequestTraceId();
    $metadata['lastTransactionId'] = getRequestTransactionId();
    $metadata['lastMutationAt'] = $now;
    if ($kind === 'prefs') {
        $metadata['prefsMutationReceipt'] = $prefsMutationReceipt;
        $metadata['prefsStartupConflictCount'] = $prefsStartupConflictCount;
    }
    if ($authoritative) $metadata[$kind . 'LegacyMigrationClosed'] = true;
    $metadata = normalizeConfigMetadata($metadata, $type);
    writeJsonObjectAtomic(getConfigMetadataPath($type), $metadata);
    return $metadata;
}
function fvplusWriteConfigPayload(string $type, string $kind, string $path, array $payload, string $prefsMutationReceipt = '', bool $authoritative = true, int $prefsStartupConflictCount = 0, bool $recoveryWrite = false): void {
    withConfigMutationLock(static function () use ($type, $kind, $path, $payload, $prefsMutationReceipt, $authoritative, $prefsStartupConflictCount, $recoveryWrite): void {
        $metadataPath = getConfigMetadataPath($type);
        $before = array_map('fvplusTransactionCaptureFile', [$path, $metadataPath]);
        $payloadCommitted = false;
        try {
            // Reconcile in memory; a rejected write must not publish a new sidecar.
            $metadata = readConfigMetadata($type, true, false);
            writeJsonObjectAtomic($path, $payload);
            $payloadCommitted = true;
            $metadata = commitConfigMetadataWrite($type, $kind, $path, $metadata, $prefsMutationReceipt, $authoritative, $prefsStartupConflictCount, $recoveryWrite);
        } catch (Throwable $error) {
            if (!$payloadCommitted) throw $error;
            $failureSnapshot = getDurableStorageRuntimeSnapshot();
            try {
                fvplusTransactionRestoreAfterFailure($before, $error, 'fvplusTransactionRestoreFiles');
            } catch (Throwable $rollbackError) {
                throw new FVPlusConfigWriteRollbackException($rollbackError->getMessage(), 0, $error);
            } finally {
                $GLOBALS['fvplus_durable_storage_snapshot'] = $failureSnapshot;
            }
            throw $error;
        }
        // Mirrors stay untouched until both primaries commit. Their failures remain non-fatal.
        fvplusWriteJsonLastGood($path, $payload);
        fvplusWriteJsonLastGood($metadataPath, $metadata);
    });
}
