<?php
function dockerBatchWaitStatePath(): string {
    global $configDir;
    return $configDir . '/docker-batch-waits.json';
}

function readDockerBatchWaitOwnership(string $nativeContent): array {
    $state = readJsonObjectFile(dockerBatchWaitStatePath()) ?? [];
    // If a process stopped during the write, its pending state is valid only
    // when the complete target was installed.
    $pending = $state['pending'] ?? [];
    $entries = ($pending['digest'] ?? null) === hash('sha256', $nativeContent)
        ? ($pending['ownership'] ?? [])
        : ($state['active'] ?? []);
    return is_array($entries) ? $entries : [];
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

function dockerAutostartToggleWaitScope(string $name, array $priorPlan, array $plan, array $ownership): array {
    // A toggle can move its batch's wait to or from another line. Restrict the
    // update to the selected record and that batch's affected tails.
    $affected = [$name => true];
    $previousSequence = array_column($priorPlan['sequence'], 'waitSource', 'name');
    $nextSequence = array_column($plan['sequence'], 'waitSource', 'name');
    foreach ($priorPlan['batches'] as $index => $beforeBatch) {
        $previousNames = $beforeBatch['containers'];
        $nextNames = $plan['batches'][$index]['containers'];
        if (!in_array($name, $previousNames, true) && !in_array($name, $nextNames, true)) continue;
        foreach ([[$previousNames, $previousSequence], [$nextNames, $nextSequence]] as [$names, $sources]) {
            $tail = end($names);
            if ($tail !== false && (($sources[$tail] ?? '') === 'batch' || isset($ownership[$tail]))) {
                $affected[$tail] = true;
            }
        }
    }
    return $affected;
}
