<?php
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");

header('Content-Type: application/json');

try {
    $action = (string)($_REQUEST['action'] ?? 'report');
    $privacyMode = normalizeDiagnosticsPrivacyMode((string)($_REQUEST['privacy'] ?? FVPLUS_DIAGNOSTICS_DEFAULT_PRIVACY));

    if ($action === 'track_event') {
        $eventType = trim((string)($_REQUEST['eventType'] ?? ''));
        if ($eventType === '') {
            throw new RuntimeException('Event type is required.');
        }
        $type = null;
        if (isset($_REQUEST['type']) && $_REQUEST['type'] !== '') {
            $type = ensureType((string)$_REQUEST['type']);
        }
        $status = (string)($_REQUEST['status'] ?? 'ok');
        $source = (string)($_REQUEST['source'] ?? 'ui');
        $detailsRaw = $_REQUEST['details'] ?? null;
        $details = [];
        if (is_string($detailsRaw) && $detailsRaw !== '') {
            $parsed = json_decode($detailsRaw, true);
            if (is_array($parsed)) {
                $details = $parsed;
            }
        } elseif (is_array($detailsRaw)) {
            $details = $detailsRaw;
        }
        $event = appendDiagnosticsHistoryEvent($eventType, $type, $details, $status, $source);
        echo json_encode([
            'ok' => true,
            'event' => $event
        ]);
        exit;
    }

    if ($action === 'report') {
        echo json_encode([
            'ok' => true,
            'diagnostics' => getDiagnosticsSnapshot($privacyMode)
        ]);
        exit;
    }

    if ($action === 'sync_docker_order') {
        syncContainerOrder('docker');
        echo json_encode([
            'ok' => true,
            'message' => 'Docker order sync completed.',
            'diagnostics' => getDiagnosticsSnapshot($privacyMode)
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
            'diagnostics' => getDiagnosticsSnapshot($privacyMode)
        ]);
        exit;
    }

    if ($action === 'create_backup') {
        $type = ensureType((string)($_REQUEST['type'] ?? ''));
        $backup = createBackupSnapshot($type, 'manual-diagnostics');
        echo json_encode([
            'ok' => true,
            'backup' => $backup,
            'diagnostics' => getDiagnosticsSnapshot($privacyMode)
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
