<?php
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");

header('Content-Type: application/json');

try {
    $type = ensureType((string)($_REQUEST['type'] ?? ''));
    $action = (string)($_REQUEST['action'] ?? 'list');

    if ($action === 'create') {
        $reason = (string)($_REQUEST['reason'] ?? 'manual');
        echo json_encode([
            'ok' => true,
            'backup' => createBackupSnapshot($type, $reason)
        ]);
        exit;
    }

    if ($action === 'restore') {
        $name = (string)($_REQUEST['name'] ?? '');
        echo json_encode([
            'ok' => true,
            'restore' => restoreBackupSnapshot($type, $name)
        ]);
        exit;
    }

    if ($action === 'restore_latest') {
        echo json_encode([
            'ok' => true,
            'restore' => restoreLatestBackupSnapshot($type)
        ]);
        exit;
    }

    if ($action === 'list') {
        echo json_encode([
            'ok' => true,
            'backups' => listBackupSnapshots($type)
        ]);
        exit;
    }

    throw new RuntimeException('Unsupported action.');
} catch (Throwable $e) {
    http_response_code(400);
    echo json_encode([
        'ok' => false,
        'error' => $e->getMessage()
    ]);
}
