<?php
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");

fvplus_json_try(function (): array {
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
        return [
            'event' => $event
        ];
    }

    if ($action === 'report') {
        return [
            'diagnostics' => getDiagnosticsSnapshot($privacyMode)
        ];
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
        return [
            'bundle' => $bundle
        ];
    }

    if ($action === 'sync_docker_order') {
        syncContainerOrder('docker');
        return [
            'message' => 'Docker order sync completed.',
            'diagnostics' => getDiagnosticsSnapshot($privacyMode)
        ];
    }

    if ($action === 'normalize_prefs') {
        $types = ['docker', 'vm'];
        foreach ($types as $type) {
            $prefs = readTypePrefs($type);
            writeTypePrefs($type, $prefs);
        }
        return [
            'message' => 'Preferences normalized and rewritten.',
            'diagnostics' => getDiagnosticsSnapshot($privacyMode)
        ];
    }

    if ($action === 'repair_paths') {
        $repair = repairPluginPaths();
        return [
            'message' => 'Plugin paths repaired.',
            'repair' => $repair,
            'diagnostics' => getDiagnosticsSnapshot($privacyMode)
        ];
    }

    if ($action === 'create_backup') {
        $type = ensureType((string)($_POST['type'] ?? ''));
        $backup = createBackupSnapshot($type, 'manual-diagnostics');
        return [
            'backup' => $backup,
            'diagnostics' => getDiagnosticsSnapshot($privacyMode)
        ];
    }

    throw new RuntimeException('Unsupported action.');
});
