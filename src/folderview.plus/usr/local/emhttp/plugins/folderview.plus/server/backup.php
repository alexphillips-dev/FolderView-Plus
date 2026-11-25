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
        'delete_all',
        'rollback_checkpoint',
        'rollback_restore_latest',
        'rollback_restore_previous',
        'rollback_restore_named'
    ];
    $guardedReadActions = ['download_post'];
    if (in_array($action, $mutatingActions, true)) {
        requireMutationRequestGuard();
    }
    if (in_array($action, $guardedReadActions, true)) {
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
            'restore' => restoreLatestGlobalRollbackSnapshot(isset($_POST['expectedName']) ? (string)$_POST['expectedName'] : null),
            'snapshots' => listGlobalRollbackSnapshots()
        ];
    }

    if ($action === 'rollback_restore_previous') {
        return [
            'restore' => restorePreviousGlobalRollbackSnapshot(isset($_POST['expectedName']) ? (string)$_POST['expectedName'] : null),
            'snapshots' => listGlobalRollbackSnapshots()
        ];
    }

    if ($action === 'rollback_restore_named') {
        return [
            'restore' => restoreGlobalRollbackSnapshot((string)($_POST['name'] ?? '')),
            'snapshots' => listGlobalRollbackSnapshots()
        ];
    }

    if ($action === 'run_schedule') {
        $requestedType = (string)($_POST['type'] ?? '');
        $report = runScheduledBackups($requestedType !== '' ? $requestedType : null);
        if ($report['failedTypes'] !== []) {
            return ['ok' => false, 'error' => 'Scheduled backup run failed.', ...$report];
        }
        return ['schedules' => $report['schedules']];
    }

    $type = ensureType((string)((in_array($action, $mutatingActions, true) || in_array($action, $guardedReadActions, true))
        ? ($_POST['type'] ?? '')
        : ($_REQUEST['type'] ?? '')));

    $streamBackupDownload = static function (string $downloadType, string $name): void {
        $downloadType = ensureType($downloadType);
        $path = getBackupSnapshotPath($downloadType, $name);
        if (!file_exists($path)) {
            throw new RuntimeException('Backup file not found.');
        }
        try {
            appendDiagnosticsHistoryEvent('backup_download', $downloadType, [
                'name' => basename($path),
                'mode' => 'post_nonce'
            ], 'ok', 'server');
        } catch (Throwable $err) {
            // Non-fatal.
        }
        header_remove('Content-Type');
        header('X-Content-Type-Options: nosniff');
        header('Cache-Control: private, no-store, max-age=0');
        header('Content-Type: application/json');
        header('Content-Disposition: attachment; filename="' . basename($path) . '"');
        header('Content-Length: ' . (string)filesize($path));
        readfile($path);
        exit;
    };

    if ($action === 'download_post') {
        $name = (string)($_POST['name'] ?? '');
        $streamBackupDownload($type, $name);
    }

    if ($action === 'create') {
        $reason = (string)($_POST['reason'] ?? 'manual');
        return [
            'backup' => createBackupSnapshot($type, $reason)
        ];
    }

    if ($action === 'restore') {
        $name = (string)($_POST['name'] ?? '');
        $options = ['createSafetyBackup' => normalizeBool($_POST['createSafetyBackup'] ?? false)];
        if (array_key_exists('expectedFolderRevision', $_POST)) {
            $expected = $_POST['expectedFolderRevision'];
            if (!is_scalar($expected) || !ctype_digit((string)$expected) || (int)$expected < 1) {
                throw new RuntimeException('Invalid expected configuration revision.');
            }
            $options['expectedFolderRevision'] = (int)$expected;
        }
        return [
            'restore' => restoreBackupSnapshot($type, $name, $options)
        ];
    }

    if ($action === 'restore_latest') {
        return [
            'restore' => restoreLatestBackupSnapshot(
                $type,
                isset($_POST['expectedName']) ? (string)$_POST['expectedName'] : null,
                isset($_POST['reviewHash']) ? (string)$_POST['reviewHash'] : null
            )
        ];
    }

    if ($action === 'restore_latest_undo') {
        return [
            'restore' => restoreLatestUndoBackupSnapshot($type)
        ];
    }

    if ($action === 'list') {
        return [
            'backups' => listBackupSnapshots($type, true),
            'schedule' => getTypeBackupSchedule($type)
        ];
    }

    if ($action === 'read') {
        $name = (string)($_REQUEST['name'] ?? '');
        return [
            'snapshot' => fvplusJsonTypeConfig(readBackupSnapshot($type, $name))
        ];
    }

    if ($action === 'delete') {
        $name = (string)($_POST['name'] ?? '');
        return [
            'deleted' => deleteBackupSnapshot($type, $name),
            'backups' => listBackupSnapshots($type, true)
        ];
    }

    if ($action === 'delete_all') {
        return [
            'deleted' => deleteAllBackupSnapshots($type),
            'backups' => listBackupSnapshots($type, true)
        ];
    }

    throw new RuntimeException('Unsupported action.');
});
