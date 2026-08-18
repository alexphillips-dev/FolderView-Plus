<?php
function dockerStartOrderNativeWait(string $line): int {
    $parts = preg_split('/\s+/', trim($line), 2);
    return normalizeIntInRange($parts[1] ?? 0, 0, 3600, 0);
}

function buildDockerStartOrderSequence(array $autostartOrder, array $context, array $plan, array $batches): array {
    $autoStartMap = (array)($context['autoStartMap'] ?? []);
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
        $wait = dockerStartOrderNativeWait((string)($autoStartMap[$name] ?? $name));
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

function applyDockerStartOrderSequenceWaits(array $lines, array $sequence): array {
    $waitByName = [];
    foreach ($sequence as $entry) {
        $name = trim((string)($entry['name'] ?? ''));
        if ($name !== '') {
            $waitByName[$name] = normalizeIntInRange($entry['wait'] ?? 0, 0, 3600, 0);
        }
    }
    foreach ($lines as $index => $line) {
        $parts = preg_split('/\s+/', trim((string)$line), 2);
        $name = (string)($parts[0] ?? '');
        if (array_key_exists($name, $waitByName)) {
            $lines[$index] = fvplus_set_autostart_line_delay((string)$line, $waitByName[$name]);
        }
    }
    return $lines;
}
