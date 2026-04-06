<?php
require_once('/usr/local/emhttp/plugins/folderview.plus/server/lib.php');

header('Content-Type: application/json');

try {
    $type = isset($argv[1]) ? trim((string)$argv[1]) : '';
    $result = runScheduledBackups($type !== '' ? $type : null);
    echo json_encode([
        'ok' => true,
        'ranAt' => gmdate('c'),
        'schedules' => $result
    ], JSON_UNESCAPED_SLASHES) . "\n";
} catch (Throwable $e) {
    echo json_encode([
        'ok' => false,
        'error' => $e->getMessage()
    ], JSON_UNESCAPED_SLASHES) . "\n";
    exit(1);
}
