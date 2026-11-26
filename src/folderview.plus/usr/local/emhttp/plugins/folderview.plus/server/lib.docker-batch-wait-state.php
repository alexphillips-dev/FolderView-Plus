<?php
function dockerBatchWaitStatePath(): string {
    global $configDir;
    return $configDir . '/docker-batch-waits.json';
}

function readDockerBatchWaitOwnership(string $nativeContent, bool &$pendingRecovery = false): array {
    $state = readJsonObjectFile(dockerBatchWaitStatePath()) ?? [];
    $pending = is_array($state['pending'] ?? null) ? $state['pending'] : [];
    $active = is_array($state['active'] ?? null) ? $state['active'] : [];
    $pendingRecovery = $pending !== [];
    $intent = is_array($pending['ownership'] ?? null) ? $pending['ownership'] : [];
    if (($pending['digest'] ?? null) === hash('sha256', $nativeContent)) return $intent;
    if (!$pendingRecovery) return $active;

    // Unraid can edit a different row after the native write and before promotion.
    $lines = array_fill_keys(preg_split('/\r?\n/', $nativeContent, -1, PREG_SPLIT_NO_EMPTY) ?: [], true);
    foreach ($intent as $name => $record) {
        $line = $record['applied'] ?? null;
        if (is_string($line) && isset($lines[$line])) $active[$name] = $record;
    }
    ksort($active, SORT_STRING);
    return $active;
}
function dockerBatchWaitUnderlyingLine(string $line, $owned): string {
    if (is_array($owned) && ($owned['applied'] ?? null) === $line && is_string($owned['original'] ?? null)) {
        $original = $owned['original'];
        $names = static fn(string $entry): string => preg_split('/\s+/', trim($entry), 2)[0] ?? '';
        if (!str_contains($original, "\n") && !str_contains($original, "\r") && $names($line) === $names($original)) {
            return $original;
        }
    }
    return $line;
}

function writeTrackedDockerOrderFile(string $path, string $content, ?callable $onWrite, int $mode = 0644, ?string $expected = null): void {
    $before = $onWrite !== null ? fvplusTransactionCaptureFile($path) : null;
    if ($expected !== null) {
        clearstatcache(true, $path);
        $actual = $before['content'] ?? (is_file($path) ? @file_get_contents($path) : '');
        if ($actual !== $expected) throw new FVPlusConfigConflictException('Docker start order sync failed');
    }
    writeDurableFileAtomic($path, $content, ['mode' => $mode]);
    if ($onWrite !== null) {
        $onWrite($before, ['path' => $path, 'exists' => true, 'content' => $content, 'mode' => $before['mode'] ?: $mode]);
    }
}

function writeDockerStartOrderChanges(array $context, string $next, array $ownership, ?callable $onWrite = null): ?string {
    $nativePath = $context['autoStartFile'];
    $original = $context['autoStartContent'];
    $previous = $context['batchWaitOwnership'] ?? [];
    $statePath = dockerBatchWaitStatePath();
    $changesOwnership = $previous !== $ownership;
    clearstatcache(true, $nativePath);
    if (!is_string($original) || (is_file($nativePath) ? @file_get_contents($nativePath) : '') !== $original) {
        return 'docker_order_native_changed';
    }

    $nativeChangedAfterWrite = false;
    try {
        if (!$changesOwnership && !empty($context['batchWaitPendingRecovery'])) {
            writeTrackedDockerOrderFile($statePath, json_encode(['active' => $previous], JSON_THROW_ON_ERROR), $onWrite, 0600);
        }
        if ($next !== $original) {
            if ($changesOwnership) {
                $pending = ['digest' => hash('sha256', $next), 'ownership' => $ownership];
                writeTrackedDockerOrderFile($statePath, json_encode(['active' => $previous, 'pending' => $pending], JSON_THROW_ON_ERROR), $onWrite, 0600);
            }
            writeTrackedDockerOrderFile($nativePath, $next, $onWrite, 0644, $original);
            $nativeChangedAfterWrite = @file_get_contents($nativePath) !== $next;
        }
        if ($changesOwnership) {
            writeTrackedDockerOrderFile($statePath, json_encode(['active' => $ownership], JSON_THROW_ON_ERROR), $onWrite, 0600);
        }
    } catch (FVPlusConfigConflictException $error) {
        return 'docker_order_native_changed';
    } catch (Throwable $error) {
        return 'docker_order_native_write_failed';
    }
    return $nativeChangedAfterWrite ? 'docker_order_native_changed' : null;
}

function applyDockerStartOrderSequenceWaits(array $lines, array $sequence, array $ownership, ?array $affectedNames = null): array {
    $entries = array_column($sequence, null, 'name');
    $nextOwnership = $affectedNames === null ? [] : array_diff_key($ownership, $affectedNames);
    foreach ($lines as $index => $line) {
        $name = preg_split('/\s+/', trim($line), 2)[0] ?? '';
        if (!isset($entries[$name]) || ($affectedNames !== null && !isset($affectedNames[$name]))) continue;
        $current = rtrim($line, "\r\n");
        $underlying = dockerBatchWaitUnderlyingLine($current, $ownership[$name] ?? null);
        $entry = $entries[$name];
        $source = $entry['waitSource'];
        $next = $underlying;
        if ($source === 'batch' || $source === 'container') {
            $next = fvplus_set_autostart_line_delay($current, $entry['wait']);
        }
        if ($source === 'batch' && $next !== $underlying) {
            $nextOwnership[$name] = ['applied' => $next, 'original' => $underlying];
        }
        $lines[$index] = $next . substr($line, strlen($current));
    }
    ksort($nextOwnership, SORT_STRING);
    return ['lines' => $lines, 'ownership' => $nextOwnership];
}
