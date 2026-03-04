<?php
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");

header('Content-Type: application/json');

try {
    $action = (string)($_REQUEST['action'] ?? 'report');

    if ($action === 'report') {
        echo json_encode([
            'ok' => true,
            'diagnostics' => getDiagnosticsSnapshot()
        ]);
        exit;
    }

    if ($action === 'sync_docker_order') {
        syncContainerOrder('docker');
        echo json_encode([
            'ok' => true,
            'message' => 'Docker order sync completed.',
            'diagnostics' => getDiagnosticsSnapshot()
        ]);
        exit;
    }

    if ($action === 'normalize_prefs') {
        $types = ['docker', 'vm'];
        foreach ($types as $type) {
            $prefs = readTypePrefs($type);
            writeTypePrefs($type, $prefs);
        }
        echo json_encode([
            'ok' => true,
            'message' => 'Preferences normalized and rewritten.',
            'diagnostics' => getDiagnosticsSnapshot()
        ]);
        exit;
    }

    if ($action === 'create_backup') {
        $type = ensureType((string)($_REQUEST['type'] ?? ''));
        $backup = createBackupSnapshot($type, 'manual-diagnostics');
        echo json_encode([
            'ok' => true,
            'backup' => $backup,
            'diagnostics' => getDiagnosticsSnapshot()
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
