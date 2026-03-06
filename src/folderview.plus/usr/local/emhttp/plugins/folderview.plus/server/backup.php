<?php
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");

fvplus_json_try(function (): array {
    $action = (string)($_REQUEST['action'] ?? 'list');
    $mutatingActions = [
        'run_schedule',
        'create',
        'restore',
        'restore_latest',
        'restore_latest_undo',
        'delete',
        'rollback_checkpoint',
        'rollback_restore_latest',
        'rollback_restore_previous'
    ];
    if (in_array($action, $mutatingActions, true)) {
        requireMutationRequestGuard();
    }

    if ($action === 'rollback_list') {
        return [
            'snapshots' => listGlobalRollbackSnapshots()
        ];
    }

    if ($action === 'rollback_checkpoint') {
        $reason = (string)($_POST['reason'] ?? 'manual');
        return [
            'rollback' => createGlobalRollbackSnapshot($reason),
            'snapshots' => listGlobalRollbackSnapshots()
        ];
    }

    if ($action === 'rollback_restore_latest') {
        return [
            'restore' => restoreLatestGlobalRollbackSnapshot(),
            'snapshots' => listGlobalRollbackSnapshots()
        ];
    }

    if ($action === 'rollback_restore_previous') {
        return [
            'restore' => restorePreviousGlobalRollbackSnapshot(),
            'snapshots' => listGlobalRollbackSnapshots()
        ];
    }

    if ($action === 'run_schedule') {
        $requestedType = (string)($_POST['type'] ?? '');
        $result = runScheduledBackups($requestedType !== '' ? $requestedType : null);
        return [
            'schedules' => $result
        ];
    }

    $type = ensureType((string)(in_array($action, $mutatingActions, true) ? ($_POST['type'] ?? '') : ($_REQUEST['type'] ?? '')));

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
        $reason = (string)($_POST['reason'] ?? 'manual');
        return [
            'backup' => createBackupSnapshot($type, $reason)
        ];
    }

    if ($action === 'restore') {
        $name = (string)($_POST['name'] ?? '');
        return [
            'restore' => restoreBackupSnapshot($type, $name)
        ];
    }

    if ($action === 'restore_latest') {
        return [
            'restore' => restoreLatestBackupSnapshot($type)
        ];
    }

    if ($action === 'restore_latest_undo') {
        return [
            'restore' => restoreLatestUndoBackupSnapshot($type)
        ];
    }

    if ($action === 'list') {
        return [
            'backups' => listBackupSnapshots($type)
        ];
    }

    if ($action === 'delete') {
        $name = (string)($_POST['name'] ?? '');
        return [
            'deleted' => deleteBackupSnapshot($type, $name),
            'backups' => listBackupSnapshots($type)
        ];
    }

    throw new RuntimeException('Unsupported action.');
});
