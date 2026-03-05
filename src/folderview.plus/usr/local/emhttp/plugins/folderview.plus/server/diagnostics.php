<?php
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");

header('Content-Type: application/json');

try {
    $action = (string)($_REQUEST['action'] ?? 'report');
    $privacyMode = normalizeDiagnosticsPrivacyMode((string)($_REQUEST['privacy'] ?? FVPLUS_DIAGNOSTICS_DEFAULT_PRIVACY));
    $mutatingActions = ['track_event', 'sync_docker_order', 'normalize_prefs', 'repair_paths', 'create_backup'];
    if (in_array($action, $mutatingActions, true)) {
        requireMutationRequestGuard();
    }

    if ($action === 'track_event') {
        $eventType = substr(trim((string)($_POST['eventType'] ?? '')), 0, 80);
        if ($eventType === '') {
            throw new RuntimeException('Event type is required.');
        }
        $type = null;
        if (isset($_POST['type']) && $_POST['type'] !== '') {
            $type = ensureType((string)$_POST['type']);
        }
        $status = substr((string)($_POST['status'] ?? 'ok'), 0, 32);
        $source = substr((string)($_POST['source'] ?? 'ui'), 0, 32);
        $detailsRaw = $_POST['details'] ?? null;
        if (is_string($detailsRaw) && strlen($detailsRaw) > 32768) {
            throw new RuntimeException('Details payload is too large.');
        }
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

    if ($action === 'support_bundle') {
        $diagnostics = getDiagnosticsSnapshot($privacyMode);
        $bundle = [
            'bundleType' => 'FolderViewPlusSupportBundle',
            'bundleVersion' => 1,
            'generatedAt' => gmdate('c'),
            'privacyMode' => $privacyMode,
            'diagnostics' => $diagnostics
        ];
        echo json_encode([
            'ok' => true,
            'bundle' => $bundle
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

    if ($action === 'repair_paths') {
        $repair = repairPluginPaths();
        echo json_encode([
            'ok' => true,
            'message' => 'Plugin paths repaired.',
            'repair' => $repair,
            'diagnostics' => getDiagnosticsSnapshot($privacyMode)
        ]);
        exit;
    }

    if ($action === 'create_backup') {
        $type = ensureType((string)($_POST['type'] ?? ''));
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
