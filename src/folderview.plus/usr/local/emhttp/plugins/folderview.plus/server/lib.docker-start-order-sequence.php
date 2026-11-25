<?php
require_once __DIR__ . '/lib.docker-batch-wait-state.php';

function dockerStartOrderNativeWait(string $line): int {
    $parts = preg_split('/\s+/', trim($line), 3);
    return preg_match('/^\d+$/D', $parts[1] ?? '') ? (int)$parts[1] : 0;
}

function buildDockerStartOrderSequence(array $autostartOrder, array $context, array $plan, array $batches, bool $managed = true): array {
    $autoStartMap = (array)($context['autoStartMap'] ?? []);
    $ownership = $managed ? ($context['batchWaitOwnership'] ?? []) : [];
    $waits = is_array($plan['containerWaits'] ?? null) ? $plan['containerWaits'] : [];
    $batchWaits = [];
    $batchIds = [];
    foreach ($batches as $batch) {
        $containers = is_array($batch['containers'] ?? null) ? $batch['containers'] : [];
        foreach ($containers as $name) {
            $batchIds[(string)$name] = (string)($batch['id'] ?? '');
        }
        if (count($containers) > 0 && (int)($batch['delay'] ?? 0) > 0) {
            $batchWaits[(string)end($containers)] = (int)$batch['delay'];
        }
    }
    $sequence = [];
    foreach ($autostartOrder as $name) {
        $name = (string)$name;
        $line = (string)($autoStartMap[$name] ?? $name);
        $wait = dockerStartOrderNativeWait(dockerBatchWaitUnderlyingLine($line, $ownership[$name] ?? null));
        $source = $wait > 0 ? 'native' : 'none';
        if (array_key_exists($name, $batchWaits)) {
            $wait = normalizeIntInRange($batchWaits[$name], 0, 3600, 0);
            $source = 'batch';
        }
        if (array_key_exists($name, $waits)) {
            $wait = normalizeIntInRange($waits[$name], 0, 3600, 0);
            $source = 'container';
        }
        $sequence[] = ['name' => $name, 'wait' => $wait, 'waitSource' => $source, 'batchId' => $batchIds[$name] ?? ''];
    }
    return $sequence;
}
