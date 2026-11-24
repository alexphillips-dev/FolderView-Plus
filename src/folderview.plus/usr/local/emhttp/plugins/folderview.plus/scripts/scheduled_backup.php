<?php
require_once __DIR__ . '/../server/lib.php';

header('Content-Type: application/json');

try {
    $type = isset($argv[1]) ? trim((string)$argv[1]) : '';
    $report = runScheduledBackups($type !== '' ? $type : null);
    $complete = $report['failedTypes'] === [];
    $response = ['ok' => $complete, 'ranAt' => gmdate('c'), 'schedules' => $report['schedules']];
    if (!$complete) {
        $response['error'] = 'Scheduled backup run failed.';
        $response['failedTypes'] = $report['failedTypes'];
    }
    echo json_encode($response, JSON_UNESCAPED_SLASHES) . "\n";
    if (!$complete) exit(1);
} catch (Throwable $e) {
    echo json_encode([
        'ok' => false,
        'error' => $e->getMessage()
    ], JSON_UNESCAPED_SLASHES) . "\n";
    exit(1);
}
