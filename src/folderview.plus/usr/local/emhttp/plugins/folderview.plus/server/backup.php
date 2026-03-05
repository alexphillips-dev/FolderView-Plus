<?php
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");

header('Content-Type: application/json');

try {
    $action = (string)($_REQUEST['action'] ?? 'list');

    if ($action === 'run_schedule') {
        $requestedType = (string)($_REQUEST['type'] ?? '');
        $result = runScheduledBackups($requestedType !== '' ? $requestedType : null);
        echo json_encode([
            'ok' => true,
            'schedules' => $result
        ]);
        exit;
    }

    $type = ensureType((string)($_REQUEST['type'] ?? ''));

    if ($action === 'download') {
        $name = (string)($_REQUEST['name'] ?? '');
        $path = getBackupSnapshotPath($type, $name);
        if (!file_exists($path)) {
            throw new RuntimeException('Backup file not found.');
        }
        try {
            appendDiagnosticsHistoryEvent('backup_download', $type, [
                'name' => basename($path)
            ], 'ok', 'server');
        } catch (Throwable $err) {
            // Non-fatal.
        }
        header_remove('Content-Type');
        header('Content-Type: application/json');
        header('Content-Disposition: attachment; filename="' . basename($path) . '"');
        header('Content-Length: ' . (string)filesize($path));
        readfile($path);
        exit;
    }

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

    if ($action === 'restore_latest_undo') {
        echo json_encode([
            'ok' => true,
            'restore' => restoreLatestUndoBackupSnapshot($type)
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

    if ($action === 'delete') {
        $name = (string)($_REQUEST['name'] ?? '');
        echo json_encode([
            'ok' => true,
            'deleted' => deleteBackupSnapshot($type, $name),
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
