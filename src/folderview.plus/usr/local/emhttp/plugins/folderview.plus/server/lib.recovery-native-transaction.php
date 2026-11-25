<?php

function fvplusTransactionRecordFileWrites(array &$writes): \Closure {
    return static function (array $before, array $after) use (&$writes): void {
        $path = $before['path'];
        $lastWrite = $writes[$path] ?? [];
        // Keep a peer's update if it superseded the previous sync pass.
        $original = ($lastWrite['restoreIfMatches'] ?? null) === $before ? $lastWrite : $before;
        $writes[$path] = ['restoreIfMatches' => $after] + $original;
    };
}

function fvplusRecoveryCaptureNativeFiles(array $options): array {
    if (!isset($options['nativeAutostart'])) return [];
    $targets = [
        'autostart' => ['path' => fvplusEnvironmentDockerAutostartPath()] + $options['nativeAutostart'],
        'batchWaits' => ['path' => dockerBatchWaitStatePath()]
            + ($options['nativeBatchWaits'] ?? ['exists' => false, 'content' => '', 'mode' => null])
    ];
    if ($targets['autostart']['path'] === $targets['batchWaits']['path']) {
        throw new RuntimeException('Native Docker autostart verification failed.');
    }
    $files = [];
    foreach ($targets as $kind => $target) {
        $before = fvplusTransactionCaptureFile($target['path']);
        $target = $target['exists'] ? $target + ['mode' => $before['mode']]
            : ['path' => $target['path'], 'exists' => false, 'content' => '', 'mode' => null];
        $files[$kind] = ['before' => $before, 'target' => $target];
    }
    return $files;
}

function fvplusApplyRecoveryNativeFile(array $before, array $target, callable $onWrite): void {
    $path = $before['path'];
    fvplusVerifyNativeAutostartTarget($path, $before);
    if ($target === $before) return;
    if (!$target['exists']) {
        if (!@unlink($path)) throw new RuntimeException('Unable to remove newly-created transaction file.');
        $onWrite($before, $target);
        return;
    }
    $mode = $target['mode'] ?: 0644;
    writeTrackedDockerOrderFile($path, $target['content'], $onWrite, $mode, $before['content']);
    $written = ['path' => $path, 'exists' => true, 'content' => $target['content'], 'mode' => $before['mode'] ?: $mode];
    if (isset($target['mode']) && $written['mode'] !== $target['mode']) {
        fvplusVerifyNativeAutostartTarget($path, $written);
        if (!@chmod($path, $target['mode'])) {
            throw new RuntimeException('Transaction rollback failed: unable to restore file permissions.');
        }
        $onWrite($written, $target);
    }
}

function fvplusRecoverySyncDockerOrder(callable $onWrite): string {
    try {
        return syncContainerOrder('docker', $onWrite)['syncOutcome'];
    } catch (Throwable $error) {
        fv3_debug_log('Recovery Docker start order sync failed');
        return 'failed';
    }
}

function fvplusApplyRecoveryNativeState(array $files, array $options, callable $onWrite): ?string {
    if ($files !== []) {
        foreach ($files as ['before' => $before, 'target' => $target]) {
            fvplusApplyRecoveryNativeFile($before, $target, $onWrite);
        }
        fvplusEnvironmentTransactionStage($options, 'external');
        return 'synced';
    }
    if (($options['syncDockerOrder'] ?? true) === false) return null;
    $outcome = fvplusRecoverySyncDockerOrder($onWrite);
    fvplusEnvironmentTransactionStage($options, 'docker-order');
    return $outcome;
}

function fvplusEncodeGlobalRollbackFile(array $file): array {
    return ['exists' => $file['exists'], 'contentBase64' => base64_encode($file['content']), 'mode' => $file['mode']];
}

function fvplusDecodeGlobalRollbackNativeFiles(array $decoded): array {
    if (!isset($decoded['nativeDockerAutostart']) && array_key_exists('nativeDockerBatchWaits', $decoded)) {
        throw new RuntimeException('Rollback snapshot format or schema version is unsupported.');
    }
    foreach (['nativeDockerAutostart', 'nativeDockerBatchWaits'] as $key) {
        if (!array_key_exists($key, $decoded)) continue;
        $native = $decoded[$key];
        $content = is_string($native['contentBase64'] ?? null) ? base64_decode($native['contentBase64'], true) : false;
        $mode = $native['mode'] ?? null;
        if (!is_bool($native['exists'] ?? null) || $content === false
            || (!$native['exists'] && ($content !== '' || $mode !== null))
            || ($native['exists'] && (!is_int($mode) || $mode < 0 || $mode > 0777))) {
            throw new RuntimeException('Rollback snapshot format or schema version is unsupported.');
        }
        $decoded[$key] = ['exists' => $native['exists'], 'content' => $content, 'mode' => $mode];
    }
    return $decoded;
}
